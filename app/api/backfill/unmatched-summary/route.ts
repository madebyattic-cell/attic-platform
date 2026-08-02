import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders, orderItems } from "@/db/schema";
import { isNull, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        description: orderItems.descriptionRaw,
        count: sql<number>`count(*)::int`,
        totalGross: sql<string>`sum(${orderItems.gross})::text`,
      })
      .from(orderItems)
      .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
      .where(isNull(orderItems.productId))
      .groupBy(orderItems.descriptionRaw)
      .orderBy(sql`count(*) desc`);

    return NextResponse.json({ ok: true, distinctCount: rows.length, rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
