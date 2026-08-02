import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, channels, metricsDaily, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_CHANNELS = ["wix", "gumroad", "behance", "creative_market"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;

  try {
    const body = await req.json();
    const { channelKey, date, views } = body as { channelKey: string; date: string; views: number };

    if (!VALID_CHANNELS.includes(channelKey)) {
      return NextResponse.json({ error: `channelKey must be one of ${VALID_CHANNELS.join(", ")}` }, { status: 400 });
    }
    if (!date || !Number.isFinite(views) || views < 0) {
      return NextResponse.json({ error: "date and a non-negative views number are required" }, { status: 400 });
    }

    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });

    const channel = await db.query.channels.findFirst({ where: eq(channels.key, channelKey) });
    if (!channel) return NextResponse.json({ error: `no '${channelKey}' row in channels table` }, { status: 500 });

    let listing = await db.query.listings.findFirst({
      where: and(eq(listings.productId, productId), eq(listings.channelId, channel.id)),
    });

    if (!listing) {
      const [created] = await db
        .insert(listings)
        .values({
          productId,
          channelId: channel.id,
          displayTitle: product.internalName,
          licenseTier: "commercial",
          status: "draft",
        })
        .returning();
      listing = created;
    }

    const existing = await db.query.metricsDaily.findFirst({
      where: and(eq(metricsDaily.listingId, listing.id), eq(metricsDaily.day, date), eq(metricsDaily.source, "manual")),
    });

    if (existing) {
      await db.update(metricsDaily).set({ views }).where(eq(metricsDaily.id, existing.id));
    } else {
      await db.insert(metricsDaily).values({ listingId: listing.id, day: date, source: "manual", views });
    }

    return NextResponse.json({ ok: true, listingId: listing.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
