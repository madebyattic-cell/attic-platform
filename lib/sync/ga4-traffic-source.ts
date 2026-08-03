import { db } from "@/db/client";
import { trafficSourceDaily, syncRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

function getClient() {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("GA4_SERVICE_ACCOUNT_KEY_BASE64 is not set.");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new BetaAnalyticsDataClient({ credentials });
}

// Groups GA4's raw session source strings into the handful of buckets the
// dashboard actually cares about, rather than showing every random referrer.
function normalizeSource(raw: string): string {
  const s = raw.toLowerCase();
  if (s === "(direct)" || s === "direct") return "Direct";
  if (s.includes("pinterest")) return "Pinterest";
  if (s.includes("instagram") || s === "ig") return "Instagram";
  if (s.includes("google")) return "Google";
  if (s.includes("facebook") || s.includes("fb")) return "Facebook";
  return "Other";
}

export async function syncGa4TrafficSource() {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "ga4_traffic_source", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) throw new Error("GA4_PROPERTY_ID is not set.");

    const client = getClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "sessionSource" }, { name: "date" }],
      metrics: [{ name: "sessions" }],
      limit: 10000,
    });

    // Aggregate normalized sources per day before writing, so "pinterest.com"
    // and "pinterest" (if GA4 ever reports both) collapse into one row.
    const byDaySource = new Map<string, number>();
    for (const row of response.rows ?? []) {
      const rawSource = row.dimensionValues?.[0]?.value ?? "";
      const rawDate = row.dimensionValues?.[1]?.value ?? "";
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      if (!rawDate || rawDate.length !== 8) continue;

      const day = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const source = normalizeSource(rawSource);
      const key = `${day}__${source}`;
      byDaySource.set(key, (byDaySource.get(key) ?? 0) + sessions);
    }

    let written = 0;
    for (const [key, sessions] of byDaySource.entries()) {
      const [day, source] = key.split("__");

      const existing = await db.query.trafficSourceDaily.findFirst({
        where: and(eq(trafficSourceDaily.day, day), eq(trafficSourceDaily.source, source)),
      });

      if (existing) {
        await db.update(trafficSourceDaily).set({ sessions }).where(eq(trafficSourceDaily.id, existing.id));
      } else {
        await db.insert(trafficSourceDaily).values({ day, source, sessions });
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
