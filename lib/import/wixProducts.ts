import { db } from "@/db/client";
import { series, products, listings, channels } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const WIX_PRODUCTS_QUERY_URL = "https://www.wixapis.com/stores/v1/products/query";

type WixProduct = {
  id: string;
  name: string;
  priceData?: { price?: number; currency?: string };
  productType?: string;
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

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Wix products query failed: ${res.status} ${body}`);
    }

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

const NUMBER_RE = /\b(\d{1,2})\b/;
const SEPARATORS = [" : ", " | "];

const BUNDLE_KEYWORDS =
  /\b(collection|bundle|definitive set|editorial visuals|editorial images|editorial mockups|stock image|mockup collection|mockup set|mockup bundle)\b/i;

const FREE_TAG_RE = /^\s*\[[^\]]*\]\s*/;

type ParseResult =
  | {
      ok: true;
      seriesNameGuess: string;
      number: number;
      descSide: string;
    }
  | { ok: false; reason: string };

function parseProductName(rawName: string): ParseResult {
  const name = rawName.replace(FREE_TAG_RE, "").trim();

  if (BUNDLE_KEYWORDS.test(name)) {
    return { ok: false, reason: "looks like a bundle/collection, not a single product" };
  }

  const usedSeparator = SEPARATORS.find((sep) => name.includes(sep));
  if (!usedSeparator) {
    return { ok: false, reason: "no ':' or '|' separator found" };
  }

  const parts = name.split(usedSeparator);
  if (parts.length !== 2) {
    return { ok: false, reason: `expected exactly one '${usedSeparator.trim()}' separator, found ${parts.length - 1}` };
  }

  const [left, right] = parts;
  const leftMatch = left.match(NUMBER_RE);
  const rightMatch = right.match(NUMBER_RE);

  if (leftMatch && rightMatch) {
    return { ok: false, reason: "both sides contain a number, ambiguous" };
  }
  if (!leftMatch && !rightMatch) {
    return { ok: false, reason: "neither side contains a number" };
  }

  const [seriesSideRaw, descSide, match] = leftMatch
    ? [left, right, leftMatch]
    : [right, left, rightMatch!];

  const number = parseInt(match[1], 10);
  if (number < 1 || number > 60) {
    return { ok: false, reason: `parsed number ${number} out of expected range` };
  }

  let seriesNameGuess = seriesSideRaw.replace(NUMBER_RE, "").trim();
  seriesNameGuess = seriesNameGuess.replace(/^the\s+/i, "").replace(/\s+series$/i, "").trim();

  if (/mockup/i.test(seriesNameGuess)) {
    return { ok: false, reason: "series-side text contains 'mockup', likely misparsed" };
  }

  const seriesWordCount = seriesNameGuess.split(/\s+/).filter(Boolean).length;
  if (seriesWordCount === 0 || seriesWordCount > 5) {
    return { ok: false, reason: `series-side text "${seriesNameGuess}" looks wrong (word count ${seriesWordCount})` };
  }

  return { ok: true, seriesNameGuess, number, descSide: descSide.trim() };
}

function splitObjectAndScene(descSide: string): { objectNoun: string; sceneName: string | null } {
  const mockupIdx = descSide.toLowerCase().indexOf("mockup");
  if (mockupIdx === -1) {
    return { objectNoun: descSide, sceneName: null };
  }
  const before = descSide.slice(0, mockupIdx).trim().replace(/^the\s+/i, "");
  let after = descSide.slice(mockupIdx + "mockup".length).trim();
  after = after.replace(/^(in|on|under|with|at|by|near)\s+/i, "");
  return {
    objectNoun: before || descSide,
    sceneName: after.length > 0 ? after : null,
  };
}

export async function importWixProductCatalog() {
  const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
  if (!channel) throw new Error("No 'wix' row in channels table — seed it first.");

  const wixProducts = await fetchAllWixProducts();

  const existingListings = await db
    .select({ externalId: listings.externalId })
    .from(listings)
    .where(eq(listings.channelId, channel.id));
  const alreadyLinked = new Set(existingListings.map((l) => l.externalId).filter(Boolean));

  const existingSeries = await db.select({ id: series.id, slug: series.slug }).from(series);
  const seriesBySlug = new Map(existingSeries.map((s) => [s.slug, s.id]));

  let createdSeries = 0;
  let createdProducts = 0;
  let createdListings = 0;
  let skippedExisting = 0;
  const ambiguous: { name: string; reason: string; price: number | null }[] = [];

  for (const wp of wixProducts) {
    if (alreadyLinked.has(wp.id)) {
      skippedExisting++;
      continue;
    }

    const parsed = parseProductName(wp.name);
    if (!parsed.ok) {
      ambiguous.push({ name: wp.name, reason: parsed.reason, price: wp.priceData?.price ?? null });
      continue;
    }

    const seriesSlug = slugify(parsed.seriesNameGuess);
    let seriesId = seriesBySlug.get(seriesSlug);

    if (!seriesId) {
      const [createdRow] = await db
        .insert(series)
        .values({
          code: seriesSlug.slice(0, 20),
          slug: seriesSlug,
          name: parsed.seriesNameGuess.replace(/\b\w/g, (c) => c.toUpperCase()),
          status: "live",
        })
        .returning({ id: series.id });
      seriesId = createdRow.id;
      seriesBySlug.set(seriesSlug, seriesId);
      createdSeries++;
    }

    const { objectNoun, sceneName } = splitObjectAndScene(parsed.descSide);

    let product = await db.query.products.findFirst({
      where: and(eq(products.seriesId, seriesId), eq(products.number, parsed.number), eq(products.kind, "single")),
    });

    if (!product) {
      const internalName = `${seriesSlug} ${String(parsed.number).padStart(2, "0")} : ${parsed.descSide}`;
      const [createdRow] = await db
        .insert(products)
        .values({
          seriesId,
          number: parsed.number,
          kind: "single",
          internalName,
          objectNoun,
          sceneName,
          status: "live",
        })
        .returning();
      product = createdRow;
      createdProducts++;
    }

    await db.insert(listings).values({
      productId: product.id,
      channelId: channel.id,
      externalId: wp.id,
      displayTitle: wp.name,
      licenseTier: "commercial",
      price: wp.priceData?.price != null ? String(wp.priceData.price) : null,
      status: "live",
    });
    createdListings++;
  }

  return {
    ok: true,
    totalWixProducts: wixProducts.length,
    createdSeries,
    createdProducts,
    createdListings,
    skippedExisting,
    ambiguousCount: ambiguous.length,
    ambiguous,
  };
}
