import { db } from "@/db/client";
import { orders, orderItems, customers, channels, syncRuns, products, listings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const GUMROAD_SALES_URL = "https://api.gumroad.com/v2/sales";
const GUMROAD_PRODUCTS_URL = "https://api.gumroad.com/v2/products";

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

type GumroadProduct = {
  id: string;
  name: string;
  permalink?: string;
  short_url?: string;
  price: number; // cents
  currency?: string;
  published?: boolean;
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

export async function fetchGumroadProducts(): Promise<GumroadProduct[]> {
  const all: GumroadProduct[] = [];
  let pageKey: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 50;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.log(`Gumroad products fetch: hit MAX_PAGES (${MAX_PAGES}), stopping`);
      break;
    }

    const url = new URL(GUMROAD_PRODUCTS_URL);
    if (pageKey) url.searchParams.set("page_key", pageKey);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}` },
    });

    const json = await res.json();

    if (!res.ok || json.success === false) {
      throw new Error(`Gumroad products fetch failed: ${res.status} ${json.message ?? ""}`);
    }

    all.push(...(json.products ?? []));
    pageKey = json.next_page_key;
  } while (pageKey);

  return all;
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
    let skippedRefunded = 0;
    let skippedDuplicate = 0;
    let pageCount = 0;
    const MAX_PAGES = 100;

    do {
      pageCount++;
      if (pageCount > MAX_PAGES) {
        console.log(`Gumroad sync: hit MAX_PAGES (${MAX_PAGES}), stopping to avoid runaway loop`);
        break;
      }

      const page = await fetchGumroadSales(pageKey);
      console.log(
        `Gumroad sync page ${pageCount}: got ${page.sales.length} sales, nextPageKey=${page.nextPageKey ?? "none"}`
      );

      for (const s of page.sales) {
        if (s.refunded || s.chargebacked) {
          skippedRefunded++;
          continue;
        }
        if (seenOrderIds.has(s.id)) {
          skippedDuplicate++;
          continue;
        }

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

    console.log(
      `Gumroad sync totals: written=${written} skippedRefunded=${skippedRefunded} skippedDuplicate=${skippedDuplicate}`
    );

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

/* ------------------------------------------------------------------ */
/* Matching Gumroad's product catalog to Made by Attic products        */
/* ------------------------------------------------------------------ */

// Words too generic to help identify a specific product.
const STOPWORDS = new Set([
  "mockup", "mockups", "psd", "file", "files", "editable", "smart", "object",
  "the", "a", "an", "on", "of", "for", "with", "and", "in", "to", "your",
]);

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: é -> e
    .replace(/[^a-z0-9\s]/g, " ")    // punctuation -> space
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Score how well a Gumroad product name matches a given Made by Attic
 * product, based on token overlap with the product's internal name.
 * Returns a 0..1 score (fraction of the product's own tokens found in
 * the Gumroad title).
 */
function matchScore(productTokens: string[], gumroadTokens: string[]): number {
  if (productTokens.length === 0) return 0;
  const gumroadSet = new Set(gumroadTokens);
  const hits = productTokens.filter((t) => gumroadSet.has(t)).length;
  return hits / productTokens.length;
}

const MATCH_THRESHOLD = 0.6;

export type GumroadMatchResult = {
  gumroadProduct: GumroadProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  score: number;
};

/**
 * Fetches Gumroad's product catalog and attempts to auto-match each one
 * against Made by Attic products by internal-name token overlap.
 * Confident matches (score >= MATCH_THRESHOLD) are written into `listings`.
 * Everything else is returned unmatched for manual reconciliation.
 */
export async function syncGumroadListings() {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "gumroad_listings", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "gumroad") });
    if (!channel) throw new Error("No 'gumroad' row in channels table — seed it first.");

    const allProducts = await db
      .select({ id: products.id, internalName: products.internalName })
      .from(products);

    const productTokenMap = allProducts.map((p) => ({
      id: p.id,
      name: p.internalName,
      tokens: normalizeTokens(p.internalName),
    }));

    // Already-linked externalIds for this channel, so we don't re-process them.
    const existingListings = await db
      .select({ externalId: listings.externalId })
      .from(listings)
      .where(eq(listings.channelId, channel.id));
    const alreadyLinked = new Set(existingListings.map((l) => l.externalId).filter(Boolean));

    const gumroadProducts = await fetchGumroadProducts();

    let matched = 0;
    let skippedExisting = 0;
    const unmatched: GumroadMatchResult[] = [];

    for (const gp of gumroadProducts) {
      const externalId = gp.permalink ?? gp.id;
      if (alreadyLinked.has(externalId)) {
        skippedExisting++;
        continue;
      }

      const gumroadTokens = normalizeTokens(gp.name);

      let best: { id: string; name: string; score: number } | null = null;
      for (const p of productTokenMap) {
        const score = matchScore(p.tokens, gumroadTokens);
        if (!best || score > best.score) {
          best = { id: p.id, name: p.name, score };
        }
      }

      if (best && best.score >= MATCH_THRESHOLD) {
        await db
          .insert(listings)
          .values({
            productId: best.id,
            channelId: channel.id,
            externalId,
            url: gp.short_url,
            displayTitle: gp.name,
            licenseTier: "commercial",
            price: String((gp.price ?? 0) / 100),
            status: gp.published ? "live" : "draft",
          })
          .onConflictDoNothing();
        matched++;
      } else {
        unmatched.push({
          gumroadProduct: gp,
          matchedProductId: best?.id ?? null,
          matchedProductName: best?.name ?? null,
          score: best?.score ?? 0,
        });
      }
    }

    console.log(
      `Gumroad listings sync: matched=${matched} unmatched=${unmatched.length} skippedExisting=${skippedExisting}`
    );

    await db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: new Date(), rowsWritten: matched })
      .where(eq(syncRuns.id, run.id));

    return { ok: true, matched, skippedExisting, unmatched };
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
