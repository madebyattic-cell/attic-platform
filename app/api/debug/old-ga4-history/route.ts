import { NextRequest, NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const OLD_VIEWS_PROPERTY_ID = "467411171";

function getClient() {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("GA4_SERVICE_ACCOUNT_KEY_BASE64 is not set.");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new BetaAnalyticsDataClient({ credentials });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const client = getClient();

    const [response] = await client.runReport({
      property: `properties/${OLD_VIEWS_PROPERTY_ID}`,
      dateRanges: [{ startDate: "2020-01-01", endDate: "yesterday" }],
      dimensions: [{ name: "pagePath" }, { name: "date" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 10000,
    });

    const rows = response.rows ?? [];

    // Find the earliest date seen per page path.
    const earliestByPath = new Map<string, string>();
    for (const row of rows) {
      const path = row.dimensionValues?.[0]?.value ?? "";
      const rawDate = row.dimensionValues?.[1]?.value ?? "";
      if (!path || rawDate.length !== 8) continue;
      const day = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const existing = earliestByPath.get(path);
      if (!existing || day < existing) earliestByPath.set(path, day);
    }

    const sample = Array.from(earliestByPath.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, 30);

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      distinctPaths: earliestByPath.size,
      earliestOverall: sample[0] ?? null,
      sampleEarliestDates: sample,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
