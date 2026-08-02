import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders, orderItems, listings } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, productId } = body as { description: string; productId: string };

    if (!description || !productId) {
      return NextResponse.json({ error: "description and productId are required" }, { status: 400 });
    }

    // Find a listing for this product to attach too, if one exists on the
    // relevant channel — not required, productId alone is enough for revenue
    // attribution, but nice to have when available.
    const anyListing = await db.query.listings.findFirst({
      where: eq(listings.productId, productId),
    });

    const result = await db.execute(sql`
      UPDATE order_items
      SET product_id = ${productId}::uuid,
          listing_id = ${anyListing?.id ?? null}::uuid
      WHERE description_raw = ${description}
        AND product_id IS NULL
    `);

    return NextResponse.json({ ok: true, updated: result.rowCount ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
