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

export async function backfillOrderAttribution() {
  // All listings, grouped by channel, with pre-tokenized titles.
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

  // Unmatched order items, joined to their order's channel.
  const unmatchedItems = await db
    .select({
      itemId: orderItems.id,
      descriptionRaw: orderItems.descriptionRaw,
      channelId: orders.channelId,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(isNull(orderItems.productId));

  let matched = 0;
  let skippedNoDescription = 0;
  let noCandidate = 0;
  const belowThreshold: { itemId: string; description: string; bestScore: number; bestTitle: string | null }[] = [];

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

    let best: { id: string; productId: string; score: number; tokens: string[] } | null = null;
    for (const c of candidates) {
      const score = matchScore(itemTokens, c.tokens);
      if (!best || score > best.score) {
        best = { id: c.id, productId: c.productId, score, tokens: c.tokens };
      }
    }

    if (best && best.score >= MATCH_THRESHOLD) {
      await db
        .update(orderItems)
        .set({ listingId: best.id, productId: best.productId })
        .where(eq(orderItems.id, item.itemId));
      matched++;
    } else {
      belowThreshold.push({
        itemId: item.itemId,
        description: item.descriptionRaw,
        bestScore: best?.score ?? 0,
        bestTitle: null,
      });
    }
  }

  return {
    ok: true,
    totalUnmatchedItems: unmatchedItems.length,
    matched,
    skippedNoDescription,
    noCandidate,
    stillUnmatchedCount: belowThreshold.length,
    // Cap the returned list so the response stays a sane size; the count above is the real total.
    stillUnmatchedSample: belowThreshold.slice(0, 50),
  };
}
