import { db } from "@/db/client";
import { listings, channels } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const WIX_PRODUCTS_QUERY_URL = "https://www.wixapis.com/stores/v1/products/query";

type WixProduct = {
  id: string;
  productPageUrl?: { base?: string; path?: string };
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

export async function fillListingUrls() {
  const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
  if (!channel) throw new Error("No 'wix' row in channels table.");

  const wixProducts = await fetchAllWixProducts();

  let updated = 0;
  let skippedNoUrl = 0;
  let skippedNoListing = 0;

  for (const wp of wixProducts) {
    const base = wp.productPageUrl?.base;
    const path = wp.productPageUrl?.path;
    if (!base || !path) {
      skippedNoUrl++;
      continue;
    }

    const fullUrl = base.replace(/\/$/, "") + path;

    const result = await db
      .update(listings)
      .set({ url: fullUrl })
      .where(and(eq(listings.channelId, channel.id), eq(listings.externalId, wp.id)))
      .returning({ id: listings.id });

    if (result.length === 0) {
      skippedNoListing++;
    } else {
      updated++;
    }
  }

  return { ok: true, totalWixProducts: wixProducts.length, updated, skippedNoUrl, skippedNoListing };
}
