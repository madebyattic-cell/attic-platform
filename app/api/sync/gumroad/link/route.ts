import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { channels, listings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { externalId, name, price, url, published, productId } = body as {
      externalId: string;
      name: string;
      price: number;
      url?: string;
      published?: boolean;
      productId: string;
    };

    if (!externalId || !productId) {
      return NextResponse.json({ error: "externalId and productId are required" }, { status: 400 });
    }

    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "gumroad") });
    if (!channel) {
      return NextResponse.json({ error: "No 'gumroad' row in channels table." }, { status: 500 });
    }

    const [created] = await db
      .insert(listings)
      .values({
        productId,
        channelId: channel.id,
        externalId,
        url,
        displayTitle: name,
        licenseTier: "commercial",
        price: String(price ?? 0),
        status: published ? "live" : "draft",
      })
      .returning({ id: listings.id });

    return NextResponse.json({ ok: true, listingId: created.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
