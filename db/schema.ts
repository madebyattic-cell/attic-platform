import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),          // "01", "02"
  slug: text("slug").notNull().unique(),          // "eclat-du-menu"
  name: text("name").notNull(),                   // "Eclat du Menu"
  subtitle: text("subtitle"),
  description: text("description"),
  pieceCount: integer("piece_count"),
  status: text("status").notNull().default("draft"), // draft | live | retired
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "restrict" }),
    number: integer("number"),                    // 1..N within the series, null for bundles
    kind: text("kind").notNull().default("single"), // single | bundle
    internalName: text("internal_name").notNull(),  // "eclat 01 : menu mockup in hand"
    objectNoun: text("object_noun").notNull(),      // "menu", "kraft box"
    sceneName: text("scene_name"),                  // "in hand", "dark leaves"
    category: text("category"),                     // maps to the Wix hub taxonomy
    broadTag: text("broad_tag"),
    specificTag: text("specific_tag"),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    complexityBand: text("complexity_band").notNull().default("standard"), // standard | complex | heavy
    smartObjectNotes: text("smart_object_notes"),
    retouchFlag: boolean("retouch_flag").notNull().default(false),
    status: text("status").notNull().default("draft"), // draft | live | retired
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    seriesNumberIdx: uniqueIndex("products_series_number_idx").on(t.seriesId, t.number, t.kind),
  })
);

// Which singles make up a bundle.
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  },
  (t) => ({
    pairIdx: uniqueIndex("bundle_items_pair_idx").on(t.bundleId, t.memberId),
  })
);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),                   // cover | preview | psd | source
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Channels and listings                                               */
/* ------------------------------------------------------------------ */

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),            // wix | gumroad | creative_market | behance
  name: text("name").notNull(),
  syncMode: text("sync_mode").notNull(),          // api | manual
  feePct: numeric("fee_pct", { precision: 6, scale: 4 }).notNull().default("0"),
  feeFixed: numeric("fee_fixed", { precision: 10, scale: 2 }).notNull().default("0"),
  processorPct: numeric("processor_pct", { precision: 6, scale: 4 }).notNull().default("0"),
  processorFixed: numeric("processor_fixed", { precision: 10, scale: 2 }).notNull().default("0"),
  merchantOfRecord: boolean("merchant_of_record").notNull().default(false),
  currency: text("currency").notNull().default("USD"),
});

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "restrict" }),
    externalId: text("external_id"),              // Wix product id, Gumroad permalink, etc.
    url: text("url"),
    displayTitle: text("display_title"),
    licenseTier: text("license_tier").notNull().default("commercial"), // personal | commercial | extended
    price: numeric("price", { precision: 10, scale: 2 }),
    // SEO fields are per listing on purpose, so no two pages chase the same term.
    keyword: text("keyword"),
    seoTitle: text("seo_title"),
    slug: text("slug"),
    metaDescription: text("meta_description"),
    altText: text("alt_text"),
    bodyCopy: text("body_copy"),
    tags: text("tags").array(),
    status: text("status").notNull().default("draft"), // draft | live | unlisted
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    productChannelTierIdx: uniqueIndex("listings_product_channel_tier_idx").on(
      t.productId,
      t.channelId,
      t.licenseTier
    ),
    externalIdx: index("listings_external_idx").on(t.channelId, t.externalId),
  })
);

/* ------------------------------------------------------------------ */
/* Customers and orders                                                */
/* ------------------------------------------------------------------ */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    name: text("name"),
    country: text("country"),
    firstChannelId: uuid("first_channel_id").references(() => channels.id),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    orderCount: integer("order_count").notNull().default(0),
    lifetimeNet: numeric("lifetime_net", { precision: 12, scale: 2 }).notNull().default("0"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    notes: text("notes"),
  },
  (t) => ({
    emailIdx: uniqueIndex("customers_email_idx").on(t.email),
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    externalOrderId: text("external_order_id"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    currency: text("currency").notNull().default("USD"),
    gross: numeric("gross", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    platformFee: numeric("platform_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    processorFee: numeric("processor_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
    net: numeric("net", { precision: 12, scale: 2 }).notNull(),
    couponCode: text("coupon_code"),
    buyerCountry: text("buyer_country"),
    source: text("source").notNull().default("api"), // api | csv | manual
    rawPayload: text("raw_payload"),
  },
  (t) => ({
    externalIdx: uniqueIndex("orders_channel_external_idx").on(t.channelId, t.externalOrderId),
    orderedAtIdx: index("orders_ordered_at_idx").on(t.orderedAt),
  })
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  descriptionRaw: text("description_raw"),        // what the channel called it, for unmatched rows
  quantity: integer("quantity").notNull().default(1),
  gross: numeric("gross", { precision: 12, scale: 2 }).notNull(),
  net: numeric("net", { precision: 12, scale: 2 }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export const metricsDaily = pgTable(
  "metrics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    source: text("source").notNull(),             // ga4 | gsc | channel | manual
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    views: integer("views"),
    sessions: integer("sessions"),
    addToCart: integer("add_to_cart"),
    sales: integer("sales"),
    revenueGross: numeric("revenue_gross", { precision: 12, scale: 2 }),
    avgPosition: numeric("avg_position", { precision: 6, scale: 2 }),
  },
  (t) => ({
    dayIdx: uniqueIndex("metrics_daily_listing_day_source_idx").on(t.listingId, t.day, t.source),
  })
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "cascade" }),
  connector: text("connector").notNull(),         // wix_orders | gumroad_sales | ga4 | gsc | cm_csv
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // running | ok | failed
  rowsWritten: integer("rows_written").notNull().default(0),
  errorMessage: text("error_message"),
});
