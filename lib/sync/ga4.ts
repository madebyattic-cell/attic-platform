import { db } from "@/db/client";
import { pageViewsDaily, syncRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

function getClient() {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("GA4_SERVICE_ACCOUNT_KEY_BASE64 is not set.");

  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

  return new BetaAnalyticsDataClient({ credentials });
}

export async function syncGa4PageViews() {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "ga4", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) throw new Error("GA4_PROPERTY_ID is not set.");

    const client = getClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "pagePath" }, { name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      limit: 10000,
    });

    let written = 0;

    for (const row of response.rows ?? []) {
      const pagePath = row.dimensionValues?.[0]?.value ?? "";
      const rawDate = row.dimensionValues?.[1]?.value ?? ""; // YYYYMMDD
      const views = Number(row.metricValues?.[0]?.value ?? 0);
      const sessions = Number(row.metricValues?.[1]?.value ?? 0);

      if (!pagePath || rawDate.length !== 8) continue;

      const day = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

      const existing = await db.query.pageViewsDaily.findFirst({
        where: and(eq(pageViewsDaily.pagePath, pagePath), eq(pageViewsDaily.day, day)),
      });

      if (existing) {
        await db
          .update(pageViewsDaily)
          .set({ views, sessions })
          .where(eq(pageViewsDaily.id, existing.id));
      } else {
        await db.insert(pageViewsDaily).values({ pagePath, day, views, sessions });
      }

      written++;
    }

    await db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: new Date(), rowsWritten: written })
      .where(eq(syncRuns.id, run.id));

    return { ok: true, written };
  } catch (err) {
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}
