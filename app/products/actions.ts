"use server";

import { db } from "@/db/client";
import { series, products, listings, channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function createProduct(formData: FormData) {
  const seriesName = String(formData.get("seriesName") ?? "").trim();
  const internalName = String(formData.get("internalName") ?? "").trim();
  const objectNoun = String(formData.get("objectNoun") ?? "").trim();
  const sceneName = String(formData.get("sceneName") ?? "").trim() || null;
  const complexityBand = String(formData.get("complexityBand") ?? "standard");

  if (!internalName || !objectNoun) {
    throw new Error("Internal name and object noun are required.");
  }

  let seriesId: string | null = null;
  if (seriesName) {
    const existing = await db.query.series.findFirst({ where: eq(series.name, seriesName) });
    if (existing) {
      seriesId = existing.id;
    } else {
      const [created] = await db
        .insert(series)
        .values({ code: seriesName.slice(0, 10), slug: seriesName.toLowerCase().replace(/\s+/g, "-"), name: seriesName })
        .returning({ id: series.id });
      seriesId = created.id;
    }
  }

  const [product] = await db
    .insert(products)
    .values({
      seriesId,
      internalName,
      objectNoun,
      sceneName,
      complexityBand,
      status: "draft",
    })
    .returning({ id: products.id });

  const allChannels = await db.select().from(channels);
  for (const channel of allChannels) {
    const priceRaw = formData.get(`price_${channel.key}`);
    if (!priceRaw || priceRaw === "") continue;

    await db.insert(listings).values({
      productId: product.id,
      channelId: channel.id,
      displayTitle: internalName,
      price: String(priceRaw),
      status: "draft",
    });
  }

  redirect("/listings");
}
