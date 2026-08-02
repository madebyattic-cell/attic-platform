import { db } from "@/db/client";
import { orders, orderItems, customers, channels, syncRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

const GUMROAD_SALES_URL = "https://api.gumroad.com/v2/sales";

type GumroadSale = {
  id: string;
  email?: string;
  full_name?: string;
  product_name?: string;
  permalink?: string;
  price: number;
  gumroad_fee?: number;
  currency?: string;
  quantity?: number;
  created_at: string;
  country?: string;
  discover_fee_charged?: boolean;
  refunded?: boolean;
  chargebacked?: boolean;
};

async function fetchGumroadSales(pageKey?: string): Promise<{ sales: GumroadSale[]; nextPageKey?: string }> {
  const url = new URL(GUMROAD_SALES_URL);
  if (pageKey) url.searchParams.set("page_key", pageKey);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}` },
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(`Gumroad sales fetch failed: ${res.status} ${json.message ?? ""}`);
  }

  return { sales: json.sales ?? [], nextPageKey: json.next_page_key };
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

export async function syncGumroadSales() {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "gumroad_sales", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "gumroad") });
    if (!channel) throw new Error("No 'gumroad' row in channels table — seed it first.");

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

    let pageKey: string | undefined;
    let written = 0;

    do {
      const page = await fetchGumroadSales(pageKey);

      for (const s of page.sales) {
        if (s.refunded || s.chargebacked) continue;
        if (seenOrderIds.has(s.id)) continue;

        const orderedAt = new Date(s.created_at);
        const grossCents = s.price ?? 0;
        const feeCents = s.gumroad_fee ?? 0;
        const gross = grossCents / 100;
        const platformFee = feeCents / 100;

        const customerId = await upsertCustomer(
          channel.id,
          customersByEmail,
          s.email,
          s.full_name,
          s.country,
          orderedAt
        );

        const [insertedOrder] = await db
          .insert(orders)
          .values({
            channelId: channel.id,
            customerId,
            externalOrderId: s.id,
            orderedAt,
            currency: (s.currency ?? "usd").toUpperCase(),
            gross: String(gross),
            platformFee: String(platformFee),
            net: String(gross - platformFee),
            buyerCountry: s.country,
            source: "api",
            rawPayload: JSON.stringify(s),
          })
          .returning({ id: orders.id });

        seenOrderIds.add(s.id);

        await db.insert(orderItems).values({
          orderId: insertedOrder.id,
          descriptionRaw: s.product_name,
          quantity: s.quantity ?? 1,
          gross: String(gross),
          net: String(gross - platformFee),
        });

        written++;
      }

      pageKey = page.nextPageKey;
    } while (pageKey);

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
