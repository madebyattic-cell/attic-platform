import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { listings, series, products } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, productId, seriesSlug, number } = body as {
      description: string;
      productId?: string;
      seriesSlug?: string;
      number?: number;
    };

    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    let resolvedProductId = productId ?? null;

    if (!resolvedProductId && seriesSlug && number != null) {
      const s = await db.query.series.findFirst({ where: eq(series.slug, seriesSlug) });
      if (!s) {
        return NextResponse.json({ error: `no series with slug "${seriesSlug}"` }, { status: 404 });
      }
      const p = await db.query.products.findFirst({
        where: and(eq(products.seriesId, s.id), eq(products.number, number), eq(products.kind, "single")),
      });
      if (!p) {
        return NextResponse.json({ error: `no product at ${seriesSlug} #${number}` }, { status: 404 });
      }
      resolvedProductId = p.id;
    }

    if (!resolvedProductId) {
      return NextResponse.json(
        { error: "provide either productId, or seriesSlug + number" },
        { status: 400 }
      );
    }

    const anyListing = await db.query.listings.findFirst({
      where: eq(listings.productId, resolvedProductId),
    });

    const result = await db.execute(sql`
      UPDATE order_items
      SET product_id = ${resolvedProductId}::uuid,
          listing_id = ${anyListing?.id ?? null}::uuid
      WHERE description_raw = ${description}
        AND product_id IS NULL
    `);

    return NextResponse.json({ ok: true, productId: resolvedProductId, updated: result.rowCount ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
