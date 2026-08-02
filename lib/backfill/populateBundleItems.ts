import { db } from "@/db/client";
import { products, bundleItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function populateBundleItems() {
  const bundles = await db
    .select({ id: products.id, internalName: products.internalName, seriesId: products.seriesId })
    .from(products)
    .where(eq(products.kind, "bundle"));

  const results: { bundleName: string; memberCount: number }[] = [];
  const needsManual: { bundleName: string; reason: string }[] = [];

  for (const bundle of bundles) {
    if (!bundle.seriesId) {
      needsManual.push({
        bundleName: bundle.internalName,
        reason: "no series set (likely a cross-series bundle) — pick members manually",
      });
      continue;
    }

    const singles = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.seriesId, bundle.seriesId), eq(products.kind, "single")));

    if (singles.length === 0) {
      needsManual.push({
        bundleName: bundle.internalName,
        reason: "no singles found in the same series",
      });
      continue;
    }

    let memberCount = 0;
    for (const single of singles) {
      await db
        .insert(bundleItems)
        .values({ bundleId: bundle.id, memberId: single.id })
        .onConflictDoNothing();
      memberCount++;
    }

    results.push({ bundleName: bundle.internalName, memberCount });
  }

  return { ok: true, bundlesProcessed: results.length, results, needsManualCount: needsManual.length, needsManual };
}
