import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { products, series } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: products.id,
        internalName: products.internalName,
        status: products.status,
        seriesName: series.name,
        number: products.number,
      })
      .from(products)
      .leftJoin(series, eq(products.seriesId, series.id))
      .orderBy(series.name, products.number);

    return NextResponse.json({ products: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
