import { db } from "@/db/client";
import { orders, orderItems, listings } from "@/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

const STOPWORDS = new Set([
  "mockup", "mockups", "psd", "file", "files", "editable", "smart", "object",
  "the", "a", "an", "on", "of", "for", "with", "and", "in", "to", "your",
]);

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

function matchScore(targetTokens: string[], candidateTokens: string[]): number {
  if (targetTokens.length === 0) return 0;
  const candidateSet = new Set(candidateTokens);
  const hits = targetTokens.filter((t) => candidateSet.has(t)).length;
  return hits / targetTokens.length;
}

const MATCH_THRESHOLD = 0.6;
const CHUNK_SIZE = 200;

export async function backfillOrderAttribution() {
  const allListings = await db
    .select({
      id: listings.id,
      productId: listings.productId,
      channelId: listings.channelId,
      displayTitle: listings.displayTitle,
    })
    .from(listings);

  const listingsByChannel = new Map<
    string,
    { id: string; productId: string; tokens: string[] }[]
  >();
  for (const l of allListings) {
    if (!l.displayTitle) continue;
    const arr = listingsByChannel.get(l.channelId) ?? [];
    arr.push({ id: l.id, productId: l.productId, tokens: normalizeTokens(l.displayTitle) });
    listingsByChannel.set(l.channelId, arr);
  }

  const unmatchedItems = await db
    .select({
      itemId: orderItems.id,
      descriptionRaw: orderItems.descriptionRaw,
      channelId: orders.channelId,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(isNull(orderItems.productId));

  let skippedNoDescription = 0;
  let noCandidate = 0;
  const toUpdate: { itemId: string; listingId: string; productId: string }[] = [];
  const belowThreshold: { itemId: string; description: string; bestScore: number }[] = [];

  // Pure in-memory matching — no DB calls in this loop, so it stays fast
  // regardless of how many order items there are.
  for (const item of unmatchedItems) {
    if (!item.descriptionRaw) {
      skippedNoDescription++;
      continue;
    }

    const candidates = listingsByChannel.get(item.channelId);
    if (!candidates || candidates.length === 0) {
      noCandidate++;
      continue;
    }

    const itemTokens = normalizeTokens(item.descriptionRaw);

    let best: { id: string; productId: string; score: number } | null = null;
    for (const c of candidates) {
      const score = matchScore(itemTokens, c.tokens);
      if (!best || score > best.score) {
        best = { id: c.id, productId: c.productId, score };
      }
    }

    if (best && best.score >= MATCH_THRESHOLD) {
      toUpdate.push({ itemId: item.itemId, listingId: best.id, productId: best.productId });
    } else {
      belowThreshold.push({
        itemId: item.itemId,
        description: item.descriptionRaw,
        bestScore: best?.score ?? 0,
      });
    }
  }

  // Write results back in bulk chunks instead of one row at a time —
  // this is what keeps thousands of rows well under the function timeout.
  let matched = 0;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const batch = toUpdate.slice(i, i + CHUNK_SIZE);
    const values = batch.map(
      (u) => sql`(${u.itemId}::uuid, ${u.listingId}::uuid, ${u.productId}::uuid)`
    );

    await db.execute(sql`
      UPDATE order_items AS oi
      SET listing_id = v.listing_id, product_id = v.product_id
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(item_id, listing_id, product_id)
      WHERE oi.id = v.item_id
    `);

    matched += batch.length;
  }

  return {
    ok: true,
    totalUnmatchedItems: unmatchedItems.length,
    matched,
    skippedNoDescription,
    noCandidate,
    stillUnmatchedCount: belowThreshold.length,
    stillUnmatchedSample: belowThreshold.slice(0, 50),
  };
}
