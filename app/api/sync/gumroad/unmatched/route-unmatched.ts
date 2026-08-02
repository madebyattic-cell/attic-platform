import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { channels, listings, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchGumroadProducts } from "@/lib/sync/gumroad";

export const maxDuration = 60;

export async function GET() {
  try {
    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "gumroad") });
    if (!channel) {
      return NextResponse.json({ error: "No 'gumroad' row in channels table." }, { status: 500 });
    }

    const existingListings = await db
      .select({ externalId: listings.externalId })
      .from(listings)
      .where(eq(listings.channelId, channel.id));
    const alreadyLinked = new Set(existingListings.map((l) => l.externalId).filter(Boolean));

    const gumroadProducts = await fetchGumroadProducts();
    const unmatched = gumroadProducts
      .filter((gp) => !alreadyLinked.has(gp.permalink ?? gp.id))
      .map((gp) => ({
        externalId: gp.permalink ?? gp.id,
        name: gp.name,
        price: (gp.price ?? 0) / 100,
        url: gp.short_url,
        published: gp.published ?? false,
      }));

    const allProducts = await db
      .select({ id: products.id, internalName: products.internalName, status: products.status })
      .from(products)
      .orderBy(products.internalName);

    return NextResponse.json({ unmatched, products: allProducts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
