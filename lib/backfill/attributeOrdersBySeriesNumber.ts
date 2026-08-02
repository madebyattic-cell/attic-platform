import { db } from "@/db/client";
import { orders, orderItems, series, products } from "@/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

// Add more shorthand codes here as you discover them.
const SHORTHAND_MAP: Record<string, string> = {
  h: "heritage",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const NUMBER_RE = /\b(\d{1,2})\b/;
const SEPARATORS = [" : ", " | ", " / "];
const BUNDLE_KEYWORDS =
  /\b(collection|bundle|definitive set|editorial visuals|editorial images|editorial mockups|stock image|stock images|mockup collection|mockup set|mockup bundle)\b/i;
const FREE_TAG_RE = /^\s*[\[(][^\])]*[\])]\s*/;
const SHORTHAND_PREFIX_RE = /^([a-z]{1,4})\s*(\d{2})\b/i;

type Extracted = { slug: string; number: number } | null;

function extractSeriesAndNumber(rawName: string): Extracted {
  const name = rawName.replace(FREE_TAG_RE, "").trim();

  const shorthandMatch = name.match(SHORTHAND_PREFIX_RE);
  if (shorthandMatch) {
    const letter = shorthandMatch[1].toLowerCase();
    const mapped = SHORTHAND_MAP[letter];
    if (mapped) {
      return { slug: mapped, number: parseInt(shorthandMatch[2], 10) };
    }
  }

  if (BUNDLE_KEYWORDS.test(name)) return null;

  const usedSeparator = SEPARATORS.find((sep) => name.includes(sep));
  if (!usedSeparator) return null;

  const parts = name.split(usedSeparator);
  if (parts.length !== 2) return null;

  const [left, right] = parts;
  const leftMatch = left.match(NUMBER_RE);
  const rightMatch = right.match(NUMBER_RE);
  if (leftMatch && rightMatch) return null;
  if (!leftMatch && !rightMatch) return null;

  const [seriesSideRaw, , match] = leftMatch ? [left, right, leftMatch] : [right, left, rightMatch!];
  const number = parseInt(match[1], 10);
  if (number < 1 || number > 60) return null;

  let seriesNameGuess = seriesSideRaw.replace(NUMBER_RE, "").trim();
  seriesNameGuess = seriesNameGuess.replace(/^the\s+/i, "").replace(/\s+series$/i, "").trim();
  if (/mockup/i.test(seriesNameGuess)) return null;

  return { slug: slugify(seriesNameGuess), number };
}

export async function attributeOrdersBySeriesNumber() {
  const allSeries = await db.select({ id: series.id, slug: series.slug }).from(series);
  const seriesIdBySlug = new Map(allSeries.map((s) => [s.slug, s.id]));

  const allProducts = await db
    .select({ id: products.id, seriesId: products.seriesId, number: products.number })
    .from(products)
    .where(eq(products.kind, "single"));
  const productBySeriesAndNumber = new Map(
    allProducts.filter((p) => p.number != null).map((p) => [`${p.seriesId}-${p.number}`, p.id])
  );

  const unmatched = await db
    .select({
      description: orderItems.descriptionRaw,
      count: sql<number>`count(*)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(isNull(orderItems.productId))
    .groupBy(orderItems.descriptionRaw);

  const resolved: { description: string; count: number; productId: string; seriesSlug: string; number: number }[] = [];
  const stillUnresolved: { description: string; count: number; reason: string }[] = [];

  for (const row of unmatched) {
    if (!row.description) {
      stillUnresolved.push({ description: "(empty)", count: row.count, reason: "no description text" });
      continue;
    }

    const extracted = extractSeriesAndNumber(row.description);
    if (!extracted) {
      stillUnresolved.push({ description: row.description, count: row.count, reason: "could not extract series/number" });
      continue;
    }

    const seriesId = seriesIdBySlug.get(extracted.slug);
    if (!seriesId) {
      stillUnresolved.push({
        description: row.description,
        count: row.count,
        reason: `no series matches slug "${extracted.slug}"`,
      });
      continue;
    }

    const productId = productBySeriesAndNumber.get(`${seriesId}-${extracted.number}`);
    if (!productId) {
      stillUnresolved.push({
        description: row.description,
        count: row.count,
        reason: `no product at ${extracted.slug} #${extracted.number}`,
      });
      continue;
    }

    resolved.push({
      description: row.description,
      count: row.count,
      productId,
      seriesSlug: extracted.slug,
      number: extracted.number,
    });
  }

  // Apply the resolved mappings — one UPDATE per distinct description,
  // which is fine since there are only dozens of these, not thousands.
  let totalItemsUpdated = 0;
  for (const r of resolved) {
    const result = await db.execute(sql`
      UPDATE order_items
      SET product_id = ${r.productId}::uuid
      WHERE description_raw = ${r.description}
        AND product_id IS NULL
    `);
    totalItemsUpdated += result.rowCount ?? r.count;
  }

  return {
    ok: true,
    distinctDescriptions: unmatched.length,
    resolvedDescriptions: resolved.length,
    totalItemsUpdated,
    resolved,
    stillUnresolvedCount: stillUnresolved.length,
    stillUnresolved: stillUnresolved.sort((a, b) => b.count - a.count),
  };
}
