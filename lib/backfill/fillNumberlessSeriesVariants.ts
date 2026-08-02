import { db } from "@/db/client";
import { series, products, listings, channels } from "@/db/schema";
import { eq, and, isNull, ilike } from "drizzle-orm";

const WIX_PRODUCTS_QUERY_URL = "https://www.wixapis.com/stores/v1/products/query";

type WixProduct = {
  id: string;
  name: string;
  priceData?: { price?: number };
};

async function fetchAllWixProducts(): Promise<WixProduct[]> {
  const all: WixProduct[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(WIX_PRODUCTS_QUERY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.WIX_API_KEY!,
        "wix-account-id": process.env.WIX_ACCOUNT_ID!,
        "wix-site-id": process.env.WIX_SITE_ID!,
      },
      body: JSON.stringify({ query: { paging: { limit, offset } } }),
    });
    if (!res.ok) throw new Error(`Wix products query failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const batch: WixProduct[] = json.products ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Matches "The Hillside Series | Facade Mockup" style names with NO digits anywhere.
const NUMBERLESS_VARIANT_RE = /^the\s+(.+?)\s+series\s*\|\s*(.+?)\s+mockup\s*$/i;
const HAS_DIGIT = /\d/;

export async function fillNumberlessSeriesVariants() {
  const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
  if (!channel) throw new Error("No 'wix' row in channels table.");

  const wixProducts = await fetchAllWixProducts();

  const existingListings = await db
    .select({ externalId: listings.externalId })
    .from(listings)
    .where(eq(listings.channelId, channel.id));
  const alreadyLinked = new Set(existingListings.map((l) => l.externalId).filter(Boolean));

  const results: { name: string; productId: string; action: "reused" | "created"; listingCreated: boolean }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const wp of wixProducts) {
    if (alreadyLinked.has(wp.id)) continue;
    if (HAS_DIGIT.test(wp.name)) continue;

    const match = wp.name.match(NUMBERLESS_VARIANT_RE);
    if (!match) continue;

    const seriesNameRaw = match[1].trim();
    const descRaw = match[2].trim();
    const seriesSlug = slugify(seriesNameRaw);

    const s = await db.query.series.findFirst({ where: eq(series.slug, seriesSlug) });
    if (!s) {
      skipped.push({ name: wp.name, reason: `no series matches slug "${seriesSlug}"` });
      continue;
    }

    let product = await db.query.products.findFirst({
      where: and(
        eq(products.seriesId, s.id),
        isNull(products.number),
        eq(products.kind, "single"),
        ilike(products.objectNoun, descRaw)
      ),
    });

    let action: "reused" | "created" = "reused";
    if (!product) {
      const [created] = await db
        .insert(products)
        .values({
          seriesId: s.id,
          number: null,
          kind: "single",
          internalName: `${seriesSlug} : ${descRaw} mockup`,
          objectNoun: descRaw,
          status: "live",
        })
        .returning();
      product = created;
      action = "created";
    }

    const existingListing = await db.query.listings.findFirst({
      where: eq(listings.productId, product.id),
    });

    let listingCreated = false;
    if (!existingListing) {
      await db.insert(listings).values({
        productId: product.id,
        channelId: channel.id,
        externalId: wp.id,
        displayTitle: wp.name,
        licenseTier: "commercial",
        price: wp.priceData?.price != null ? String(wp.priceData.price) : null,
        status: "live",
      });
      listingCreated = true;
    }

    results.push({ name: wp.name, productId: product.id, action, listingCreated });
  }

  return { ok: true, processed: results.length, results, skippedCount: skipped.length, skipped };
}
