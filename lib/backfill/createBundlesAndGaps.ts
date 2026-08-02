import { db } from "@/db/client";
import { series, products } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function getOrCreateSeries(slug: string, name: string, code: string): Promise<string> {
  const existing = await db.query.series.findFirst({ where: eq(series.slug, slug) });
  if (existing) return existing.id;
  const [created] = await db
    .insert(series)
    .values({ code, slug, name, status: "live" })
    .returning({ id: series.id });
  return created.id;
}

async function getSeriesIdBySlug(slug: string): Promise<string> {
  const s = await db.query.series.findFirst({ where: eq(series.slug, slug) });
  if (!s) throw new Error(`Expected existing series "${slug}" not found — check the slug.`);
  return s.id;
}

async function getOrCreateProduct(params: {
  seriesId: string | null;
  number: number | null;
  kind: "single" | "bundle";
  internalName: string;
  objectNoun: string;
}): Promise<string> {
  if (params.seriesId && params.number != null) {
    const existing = await db.query.products.findFirst({
      where: and(
        eq(products.seriesId, params.seriesId),
        eq(products.number, params.number),
        eq(products.kind, params.kind)
      ),
    });
    if (existing) return existing.id;
  }
  const [created] = await db
    .insert(products)
    .values({
      seriesId: params.seriesId,
      number: params.number,
      kind: params.kind,
      internalName: params.internalName,
      objectNoun: params.objectNoun,
      status: "live",
    })
    .returning({ id: products.id });
  return created.id;
}

async function mapDescriptions(productId: string, descriptions: string[]) {
  let total = 0;
  for (const desc of descriptions) {
    const result = await db.execute(sql`
      UPDATE order_items
      SET product_id = ${productId}::uuid
      WHERE description_raw = ${desc}
        AND product_id IS NULL
    `);
    total += result.rowCount ?? 0;
  }
  return total;
}

export async function createBundlesAndGaps() {
  const results: { name: string; productId: string; itemsUpdated: number }[] = [];

  // ---- Series-specific bundles ----
  const greenscapeId = await getSeriesIdBySlug("greenscape");
  const starkId = await getSeriesIdBySlug("stark");
  const siennaId = await getSeriesIdBySlug("sienna");
  const neutralsId = await getSeriesIdBySlug("neutrals");
  const alchemyId = await getSeriesIdBySlug("alchemy");
  const eclatId = await getSeriesIdBySlug("eclat-du-menu");
  const hillsideId = await getSeriesIdBySlug("hillside");
  const heritageId = await getSeriesIdBySlug("heritage");

  const bundleSpecs: {
    name: string;
    seriesId: string | null;
    objectNoun: string;
    descriptions: string[];
  }[] = [
    {
      name: "greenscape collection : full bundle",
      seriesId: greenscapeId,
      objectNoun: "mockup bundle",
      descriptions: ["Greenscape Collection"],
    },
    {
      name: "greenscape collection : stock images",
      seriesId: greenscapeId,
      objectNoun: "stock image bundle",
      descriptions: ["Greenscape | 100 Stock Images", "Greenscape | 100 Editorial Visuals"],
    },
    {
      name: "stark collection : full bundle",
      seriesId: starkId,
      objectNoun: "mockup bundle",
      descriptions: ["Stark Collection", "The Stark Collection | 20 Editorial Mockups"],
    },
    {
      name: "sienna collection : full bundle",
      seriesId: siennaId,
      objectNoun: "mockup bundle",
      descriptions: [
        "Sienna Collection",
        "sienna : mockup collection",
        "Sienna Collection | 10 Quiet Luxury Mockups",
      ],
    },
    {
      name: "the neutrals collection : full bundle",
      seriesId: neutralsId,
      objectNoun: "mockup bundle",
      descriptions: ["The Neutrals Collection", "the neutrals : mockup collection"],
    },
    {
      name: "the neutrals collection : stock images",
      seriesId: neutralsId,
      objectNoun: "stock image bundle",
      descriptions: ["The Neutrals | 50 Editorial Visuals", "The Neutrals / Stock Images"],
    },
    {
      name: "the alchemy set",
      seriesId: alchemyId,
      objectNoun: "mockup bundle",
      descriptions: ["The Alchemy Set"],
    },
    {
      name: "the eclat collection : 5 luxury menu mockups",
      seriesId: eclatId,
      objectNoun: "mockup bundle",
      descriptions: [
        "The Eclat Collection: 5 Luxury Menu Mockups (Bundle)",
        "The Eclat Collection | 5 Luxury Menu Mockups",
      ],
    },
    {
      name: "hillside series : the definitive set (28 mockups)",
      seriesId: hillsideId,
      objectNoun: "mockup bundle",
      descriptions: ["Hillside Series | The Definitive Set (28 Mockups)"],
    },
  ];

  for (const spec of bundleSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: spec.seriesId,
      number: null,
      kind: "bundle",
      internalName: spec.name,
      objectNoun: spec.objectNoun,
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.name, productId, itemsUpdated });
  }

  // ---- Standalone stock-image series (own series, bundle-only) ----
  const americanElegyId = await getOrCreateSeries("american-elegy", "American Elegy", "american-elegy");
  const equinoxId = await getOrCreateSeries("equinox", "Equinox", "equinox");

  const standaloneSpecs = [
    { name: "american elegy : stock image collection", seriesId: americanElegyId, descriptions: ["American Elegy | Stock Image Collection"] },
    { name: "equinox : stock image collection", seriesId: equinoxId, descriptions: ["EQUINOX | Stock Image Collection"] },
  ];
  for (const spec of standaloneSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: spec.seriesId,
      number: null,
      kind: "bundle",
      internalName: spec.name,
      objectNoun: "stock image bundle",
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.name, productId, itemsUpdated });
  }

  // ---- Cross-series flagship bundles (no single series) ----
  const crossSeriesSpecs = [
    { name: "attic essentials : mockup bundle", descriptions: ["Attic Essentials | Mockup Bundle"] },
    { name: "five moods : the 50 mockup bundle", descriptions: ["Five Moods | The 50 Mockup Bundle", "50 Mockup Bundle"] },
  ];
  for (const spec of crossSeriesSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: null,
      number: null,
      kind: "bundle",
      internalName: spec.name,
      objectNoun: "mockup bundle",
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.name, productId, itemsUpdated });
  }

  // ---- Sienna II: real second series ----
  const siennaIiId = await getOrCreateSeries("sienna-ii", "Sienna II", "sienna-ii");
  const siennaIiSpecs = [
    { number: 11, internalName: "sienna-ii 11 : storefront", objectNoun: "storefront", descriptions: ["Sienna II | 11 Storefront"] },
    { number: 12, internalName: "sienna-ii 12 : macbook mockup", objectNoun: "macbook", descriptions: ["Sienna II | 12 Macbook Mockup"] },
  ];
  for (const spec of siennaIiSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: siennaIiId,
      number: spec.number,
      kind: "single",
      internalName: spec.internalName,
      objectNoun: spec.objectNoun,
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.internalName, productId, itemsUpdated });
  }

  // ---- Real gaps: existing series, missing numbered slots ----
  const gapSpecs = [
    { seriesId: alchemyId, number: 10, internalName: "alchemy 10 : modern canvas", objectNoun: "canvas", descriptions: ["The Alchemy / 10 Modern Canvas", "Alchemy 10 | Architectural Laptop Mockup"] },
    { seriesId: heritageId, number: 5, internalName: "heritage 05 : storefront mockup", objectNoun: "storefront", descriptions: ["H05 Storefront Mockup"] },
  ];
  for (const spec of gapSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: spec.seriesId,
      number: spec.number,
      kind: "single",
      internalName: spec.internalName,
      objectNoun: spec.objectNoun,
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.internalName, productId, itemsUpdated });
  }

  // ---- Numberless Hillside variants (no series number ever assigned) ----
  const hillsideVariantSpecs = [
    { internalName: "hillside : facade mockup", objectNoun: "facade", descriptions: ["The Hillside Series | Facade Mockup"] },
    { internalName: "hillside : outdoor flag mockup", objectNoun: "outdoor flag", descriptions: ["The Hillside Series | Outdoor Flag Mockup"] },
    { internalName: "hillside : underpass citylight mockup", objectNoun: "underpass citylight", descriptions: ["The Hillside Series | Underpass Citylight Mockup"] },
    { internalName: "hillside : exterior signage mockup", objectNoun: "exterior signage", descriptions: ["The Hillside Series | Exterior Signage Mockup"] },
  ];
  for (const spec of hillsideVariantSpecs) {
    const productId = await getOrCreateProduct({
      seriesId: hillsideId,
      number: null,
      kind: "single",
      internalName: spec.internalName,
      objectNoun: spec.objectNoun,
    });
    const itemsUpdated = await mapDescriptions(productId, spec.descriptions);
    results.push({ name: spec.internalName, productId, itemsUpdated });
  }

  return { ok: true, results, totalItemsUpdated: results.reduce((s, r) => s + r.itemsUpdated, 0) };
}
