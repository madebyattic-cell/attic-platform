import { db } from "@/db/client";
import { orders, orderItems, series, products } from "@/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

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
const LEADING_NUMBER_RE = /^\s*(\d{1,2})\b/;
const SEPARATORS = [" : ", " | ", " / "];
const BUNDLE_KEYWORDS =
  /\b(collection|bundle|definitive set|editorial visuals|editorial images|editorial mockups|stock image|stock images|mockup collection|mockup set|mockup bundle)\b/i;
const FREE_TAG_RE = /^\s*[\[(][^\])]*[\])]\s*/;
const SHORTHAND_PREFIX_RE = /^([a-z]{1,4})\s*(\d{2})\b/i;

function cleanSeriesName(raw: string): string {
  return raw.replace(NUMBER_RE, "").replace(/^the\s+/i, "").replace(/\s+series$/i, "").trim();
}

type Extracted = { slug: string; number: number } | null;

function extractSeriesAndNumber(rawName: string, knownSlugs: Set<string>): Extracted {
  const name = rawName.replace(FREE_TAG_RE, "").trim();

  const shorthandMatch = name.match(SHORTHAND_PREFIX_RE);
  if (shorthandMatch) {
    const mapped = SHORTHAND_MAP[shorthandMatch[1].toLowerCase()];
    if (mapped) return { slug: mapped, number: parseInt(shorthandMatch[2], 10) };
  }

  if (BUNDLE_KEYWORDS.test(name)) return null;

  const usedSeparator = SEPARATORS.find((sep) => name.includes(sep));
  if (!usedSeparator) return null;

  const parts = name.split(usedSeparator);
  if (parts.length !== 2) return null;

  const [left, right] = parts.map((p) => p.trim());
  const leftHasNumber = NUMBER_RE.test(left);
  const rightHasNumber = NUMBER_RE.test(right);
  if (leftHasNumber && rightHasNumber) return null;
  if (!leftHasNumber && !rightHasNumber) return null;

  const numberSide = leftHasNumber ? left : right;
  const otherSide = leftHasNumber ? right : left;
  const numberMatch = numberSide.match(NUMBER_RE)!;
  const number = parseInt(numberMatch[1], 10);
  if (number < 1 || number > 60) return null;

  // Interpretation A: the number-bearing side, minus its digit, is the series name.
  const guessA = cleanSeriesName(numberSide);
  const slugA = slugify(guessA);

  // Interpretation B: the OTHER side is the series name, and the number-bearing
  // side is really "NN description" — only valid if the number leads that side.
  let slugB: string | null = null;
  if (LEADING_NUMBER_RE.test(numberSide)) {
    const guessB = otherSide.replace(/^the\s+/i, "").replace(/\s+series$/i, "").trim();
    if (guessB.length > 0 && !/mockup/i.test(guessB)) {
      slugB = slugify(guessB);
    }
  }

  if (slugA && knownSlugs.has(slugA) && !/mockup/i.test(guessA)) return { slug: slugA, number };
  if (slugB && knownSlugs.has(slugB)) return { slug: slugB, number };
  // Fall back to interpretation A even if unverified, same as before —
  // the caller will report "no series matches" if it's wrong, not silently miss it.
  if (!/mockup/i.test(guessA) && guessA.split(/\s+/).filter(Boolean).length <= 5) {
    return { slug: slugA, number };
  }
  return null;
}

export async function attributeOrdersBySeriesNumber() {
  const allSeries = await db.select({ id: series.id, slug: series.slug }).from(series);
  const seriesIdBySlug = new Map(allSeries.map((s) => [s.slug, s.id]));
  const knownSlugs = new Set(allSeries.map((s) => s.slug));

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

    const extracted = extractSeriesAndNumber(row.description, knownSlugs);
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
