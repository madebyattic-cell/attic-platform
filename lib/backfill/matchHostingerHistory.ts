import { db } from "@/db/client";
import { series, products, listings, channels } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const OLD_VIEWS_PROPERTY_ID = "467411171";

// Confirmed earlier tonight by cross-checking real order history.
const FREE_CODE_MAP: Record<string, string> = {
  "001": "alchemy 11 : The Urban Canvas Mockup",
  "002": "sienna 11 : The Boutique Entrance Mockup",
  "004": "greenscape 11 : city light poster mockup",
  "005": "zephyr 01 : The Grounded Tote Bag Mockup",
};

const STOPWORDS = new Set(["mockup", "mockups", "the", "a", "an", "on", "of", "for", "with", "and"]);

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function matchScore(targetTokens: string[], candidateTokens: string[]): number {
  if (targetTokens.length === 0) return 0;
  const set = new Set(candidateTokens);
  const hits = targetTokens.filter((t) => set.has(t)).length;
  return hits / targetTokens.length;
}

function getClient() {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("GA4_SERVICE_ACCOUNT_KEY_BASE64 is not set.");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new BetaAnalyticsDataClient({ credentials });
}

async function getEarliestDateByPath(): Promise<Map<string, string>> {
  const client = getClient();
  const [response] = await client.runReport({
    property: `properties/${OLD_VIEWS_PROPERTY_ID}`,
    dateRanges: [{ startDate: "2020-01-01", endDate: "yesterday" }],
    dimensions: [{ name: "pagePath" }, { name: "date" }],
    metrics: [{ name: "screenPageViews" }],
    limit: 10000,
  });

  const earliestByPath = new Map<string, string>();
  for (const row of response.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const rawDate = row.dimensionValues?.[1]?.value ?? "";
    if (!path || rawDate.length !== 8) continue;
    const day = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const existing = earliestByPath.get(path);
    if (!existing || day < existing) earliestByPath.set(path, day);
  }
  return earliestByPath;
}

export async function matchHostingerHistory() {
  const earliestByPath = await getEarliestDateByPath();

  const allSeries = await db.select({ id: series.id, slug: series.slug }).from(series);
  const allProducts = await db
    .select({ id: products.id, seriesId: products.seriesId, number: products.number, kind: products.kind, objectNoun: products.objectNoun, sceneName: products.sceneName, internalName: products.internalName })
    .from(products);

  const productBySeriesAndNumber = new Map(
    allProducts
      .filter((p) => p.seriesId && p.number != null && p.kind === "single")
      .map((p) => [`${p.seriesId}-${p.number}`, p.id])
  );
  const bundleBySeries = new Map(
    allProducts.filter((p) => p.seriesId && p.kind === "bundle").map((p) => [p.seriesId, p.id])
  );
  const singlesBySeries = new Map<string, typeof allProducts>();
  for (const p of allProducts) {
    if (p.seriesId && p.kind === "single") {
      const arr = singlesBySeries.get(p.seriesId) ?? [];
      arr.push(p);
      singlesBySeries.set(p.seriesId, arr);
    }
  }
  const productByInternalName = new Map(allProducts.map((p) => [p.internalName, p.id]));

  const matched: { path: string; date: string; productId: string; productName: string }[] = [];
  const ambiguous: { path: string; date: string; reason: string }[] = [];

  for (const [rawPath, date] of earliestByPath.entries()) {
    const path = rawPath.replace(/^\//, "").replace(/\/$/, "");

    if (path === "" || ["all-mockups", "mockup-collection", "checkout"].includes(path)) continue;

    // Free-product codes, matched by the confirmed map from tonight's order work.
    const freeMatch = path.match(/^free-(\d{3})-/);
    if (freeMatch) {
      const internalName = FREE_CODE_MAP[freeMatch[1]];
      const productId = internalName ? productByInternalName.get(internalName) : undefined;
      if (productId) {
        matched.push({ path: rawPath, date, productId, productName: internalName! });
      } else {
        ambiguous.push({ path: rawPath, date, reason: `free code ${freeMatch[1]} not in known map` });
      }
      continue;
    }

    // Find which series this path belongs to, if any.
    const matchedSeries = allSeries.find((s) => {
      const prefixes = [s.slug, `the-${s.slug}`, s.slug.replace(/-/g, "")];
      return prefixes.some((p) => path === p || path.startsWith(`${p}-`));
    });

    if (!matchedSeries) {
      ambiguous.push({ path: rawPath, date, reason: "no series prefix matched" });
      continue;
    }

    const usedPrefix = [matchedSeries.slug, `the-${matchedSeries.slug}`, matchedSeries.slug.replace(/-/g, "")].find(
      (p) => path === p || path.startsWith(`${p}-`)
    )!;
    const suffix = path.slice(usedPrefix.length).replace(/^-/, "");

    // Bundle indicators.
    if (/\b(products|mockup-set|mockup-collection|collection)\b/.test(suffix) || suffix === "") {
      const bundleId = bundleBySeries.get(matchedSeries.id);
      if (bundleId) {
        const name = allProducts.find((p) => p.id === bundleId)?.internalName ?? "bundle";
        matched.push({ path: rawPath, date, productId: bundleId, productName: name });
      } else {
        ambiguous.push({ path: rawPath, date, reason: `bundle-like path but no bundle product for series "${matchedSeries.slug}"` });
      }
      continue;
    }

    // Single digit group → try exact slot match first.
    const digitGroups = suffix.match(/\d{1,3}/g) ?? [];
    if (digitGroups.length === 1) {
      const num = parseInt(digitGroups[0], 10);
      const productId = productBySeriesAndNumber.get(`${matchedSeries.id}-${num}`);
      if (productId) {
        const name = allProducts.find((p) => p.id === productId)?.internalName ?? "";
        matched.push({ path: rawPath, date, productId, productName: name });
        continue;
      }
    }

    // Fall back to token overlap against singles in this series.
    const suffixTokens = normalizeTokens(suffix);
    const candidates = singlesBySeries.get(matchedSeries.id) ?? [];
    let best: { id: string; name: string; score: number } | null = null;
    for (const c of candidates) {
      const candidateTokens = normalizeTokens(`${c.objectNoun ?? ""} ${c.sceneName ?? ""}`);
      const score = matchScore(suffixTokens, candidateTokens);
      if (!best || score > best.score) best = { id: c.id, name: c.internalName, score };
    }

    if (best && best.score >= 0.6) {
      matched.push({ path: rawPath, date, productId: best.id, productName: best.name });
    } else {
      ambiguous.push({
        path: rawPath,
        date,
        reason: `series "${matchedSeries.slug}" matched but no confident product (best score ${best?.score.toFixed(2) ?? "0"})`,
      });
    }
  }

  // Apply matches: keep the EARLIEST date per product across all its matched paths.
  const earliestPerProduct = new Map<string, string>();
  for (const m of matched) {
    const existing = earliestPerProduct.get(m.productId);
    if (!existing || m.date < existing) earliestPerProduct.set(m.productId, m.date);
  }

  const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
  let updated = 0;
  if (channel) {
    for (const [productId, date] of earliestPerProduct.entries()) {
      const result = await db
        .update(listings)
        .set({ publishedAt: new Date(date + "T00:00:00Z") })
        .where(and(eq(listings.productId, productId), eq(listings.channelId, channel.id)))
        .returning({ id: listings.id });
      updated += result.length;
    }
  }

  return {
    ok: true,
    totalPaths: earliestByPath.size,
    matchedCount: matched.length,
    productsUpdated: updated,
    matched,
    ambiguousCount: ambiguous.length,
    ambiguous,
  };
}
