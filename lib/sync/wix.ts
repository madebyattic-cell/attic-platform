import { db } from "@/db/client";
import { orders, orderItems, customers, channels, syncRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

const WIX_ORDERS_SEARCH_URL = "https://www.wixapis.com/ecom/v1/orders/search";

type WixOrder = {
  id: string;
  number?: string;
  createdDate: string;
  buyerInfo?: { email?: string; firstName?: string; lastName?: string };
  priceSummary?: { subtotal?: { amount?: string }; total?: { amount?: string }; discount?: { amount?: string } };
  billingInfo?: { address?: { country?: string } };
  currency?: string;
  lineItems?: Array<{
    id: string;
    productName?: { original?: string };
    quantity?: number;
    price?: { amount?: string };
    totalPriceAfterTax?: { amount?: string };
  }>;
};

async function fetchWixOrders(cursor?: string): Promise<{ orders: WixOrder[]; nextCursor?: string }> {
  const res = await fetch(WIX_ORDERS_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.WIX_API_KEY!,
      "wix-account-id": process.env.WIX_ACCOUNT_ID!,
      "wix-site-id": process.env.WIX_SITE_ID!,
    },
    body: JSON.stringify({
      search: {
        cursorPaging: { limit: 100, cursor },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wix orders search failed: ${res.status} ${body}`);
  }

  const json = await res.json();
  console.log("Wix raw response keys:", Object.keys(json), "metadata:", JSON.stringify(json.metadata ?? {}));
  return {
    orders: json.orders ?? [],
    nextCursor: json.metadata?.cursors?.next,
  };
}

async function upsertCustomer(
  channelId: string,
  existingByEmail: Map<string, { id: string; orderCount: number }>,
  email?: string,
  name?: string,
  country?: string,
  orderedAt?: Date
) {
  if (!email) return null;

  const existing = existingByEmail.get(email);

  if (existing) {
    await db
      .update(customers)
      .set({ lastOrderAt: orderedAt, orderCount: existing.orderCount + 1 })
      .where(eq(customers.id, existing.id));
    existingByEmail.set(email, { id: existing.id, orderCount: existing.orderCount + 1 });
    return existing.id;
  }

  const [created] = await db
    .insert(customers)
    .values({
      email,
      name,
      country,
      firstChannelId: channelId,
      firstOrderAt: orderedAt,
      lastOrderAt: orderedAt,
      orderCount: 1,
    })
    .returning({ id: customers.id });

  existingByEmail.set(email, { id: created.id, orderCount: 1 });
  return created.id;
}

export async function syncWixOrders() {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "wix_orders", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
    if (!channel) throw new Error("No 'wix' row in channels table — seed it first.");

    const existingOrders = await db
      .select({ externalOrderId: orders.externalOrderId })
      .from(orders)
      .where(eq(orders.channelId, channel.id));
    const seenOrderIds = new Set(existingOrders.map((o) => o.externalOrderId));

    const existingCustomers = await db
      .select({ id: customers.id, email: customers.email, orderCount: customers.orderCount })
      .from(customers);
    const customersByEmail = new Map(
      existingCustomers
        .filter((c): c is { id: string; email: string; orderCount: number } => !!c.email)
        .map((c) => [c.email, { id: c.id, orderCount: c.orderCount }])
    );

    let cursor: string | undefined;
    let written = 0;
    let pageCount = 0;
    const MAX_PAGES = 20;

    do {
      pageCount++;
      if (pageCount > MAX_PAGES) {
        console.log(`Wix sync: hit MAX_PAGES (${MAX_PAGES}), stopping to avoid runaway loop`);
        break;
      }

      const page = await fetchWixOrders(cursor);
      console.log(
        `Wix sync page ${pageCount}: got ${page.orders.length} orders, nextCursor=${page.nextCursor ?? "none"}`
      );

      for (const o of page.orders) {
        if (seenOrderIds.has(o.id)) continue;

        const orderedAt = new Date(o.createdDate);
        const gross = Number(o.priceSummary?.total?.amount ?? 0);
        const discount = Number(o.priceSummary?.discount?.amount ?? 0);

        const customerId = await upsertCustomer(
          channel.id,
          customersByEmail,
          o.buyerInfo?.email,
          [o.buyerInfo?.firstName, o.buyerInfo?.lastName].filter(Boolean).join(" ") || undefined,
          o.billingInfo?.address?.country,
          orderedAt
        );

        const [insertedOrder] = await db
          .insert(orders)
          .values({
            channelId: channel.id,
            customerId,
            externalOrderId: o.id,
            orderedAt,
            currency: o.currency ?? "USD",
            gross: String(gross),
            discount: String(discount),
            net: String(gross - discount),
            buyerCountry: o.billingInfo?.address?.country,
            source: "api",
            rawPayload: JSON.stringify(o),
          })
          .returning({ id: orders.id });

        seenOrderIds.add(o.id);

        for (const li of o.lineItems ?? []) {
          await db.insert(orderItems).values({
            orderId: insertedOrder.id,
            descriptionRaw: li.productName?.original,
            quantity: li.quantity ?? 1,
            gross: String(Number(li.price?.amount ?? 0)),
            net: String(Number(li.totalPriceAfterTax?.amount ?? li.price?.amount ?? 0)),
          });
        }

        written++;
      }

      cursor = page.nextCursor;
    } while (cursor);

    await db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: new Date(), rowsWritten: written })
      .where(eq(syncRuns.id, run.id));

    return { ok: true, written };
  } catch (err) {
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}
