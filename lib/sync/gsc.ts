import { db } from "@/db/client";
import { metricsDaily, listings, channels, syncRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql as sqlRaw } from "drizzle-orm";
import { GoogleAuth } from "google-auth-library";

// Set this once you've confirmed the property type in step 1 —
// "sc-domain:madebyattic.com" for a Domain property, or
// "https://www.madebyattic.com/" for a URL-prefix property.
const SITE_URL = process.env.GSC_SITE_URL || "sc-domain:madebyattic.com";

const SEARCH_ANALYTICS_URL = (site: string) =>
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;

function getAuthClient() {
  const b64 = process.env.GA4_SERVICE_ACCOUNT_KEY_BASE64;
  if (!b64) throw new Error("GA4_SERVICE_ACCOUNT_KEY_BASE64 is not set.");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  return new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

type GscRow = {
  keys: string[]; // [page, date] given our dimensions order
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function fetchSearchAnalytics(accessToken: string, startDate: string): Promise<GscRow[]> {
  const allRows: GscRow[] = [];
  let startRow = 0;
  const rowLimit = 25000;

  while (true) {
    const res = await fetch(SEARCH_ANALYTICS_URL(SITE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDate,
        endDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        dimensions: ["page", "date"],
        rowLimit,
        startRow,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Search Console query failed: ${res.status} ${body}`);
    }

    const json = await res.json();
    const rows: GscRow[] = json.rows ?? [];
    allRows.push(...rows);

    if (rows.length < rowLimit) break;
    startRow += rowLimit;
  }

  return allRows;
}

export async function syncSearchConsole(startDate: string = "2024-01-01") {
  const [run] = await db
    .insert(syncRuns)
    .values({ connector: "gsc", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const auth = getAuthClient();
    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();
    const accessToken = accessTokenResponse.token;
    if (!accessToken) throw new Error("Failed to obtain access token for Search Console.");

    const rows = await fetchSearchAnalytics(accessToken, startDate);

    const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
    if (!channel) throw new Error("No 'wix' row in channels table.");

    const allListings = await db
      .select({ id: listings.id, url: listings.url })
      .from(listings)
      .where(eq(listings.channelId, channel.id));

    // Build a lookup from URL path -> listingId, same approach as the
    // GA4/Analytics matching.
    const listingByPath = new Map<string, string>();
    for (const l of allListings) {
      if (!l.url) continue;
      const path = l.url.replace(/^https?:\/\/[^/]+/, "");
      listingByPath.set(path, l.id);
    }

    let written = 0;
    let skippedNoMatch = 0;
    const toUpsert: { listingId: string; day: string; clicks: number; impressions: number; avgPosition: string }[] = [];

    for (const row of rows) {
      const [pageUrl, day] = row.keys;
      const path = pageUrl.replace(/^https?:\/\/[^/]+/, "");
      const listingId = listingByPath.get(path);

      if (!listingId) {
        skippedNoMatch++;
        continue;
      }

      toUpsert.push({
        listingId,
        day,
        clicks: Math.round(row.clicks),
        impressions: Math.round(row.impressions),
        avgPosition: String(row.position),
      });
    }

    const CHUNK_SIZE = 200;
    for (let i = 0; i < toUpsert.length; i += CHUNK_SIZE) {
      const batch = toUpsert.slice(i, i + CHUNK_SIZE);
      const values = batch.map(
        (r) =>
          sqlRaw`(${r.listingId}::uuid, ${r.day}::date, 'gsc', ${r.clicks}::int, ${r.impressions}::int, ${r.avgPosition}::numeric)`
      );

      await db.execute(sqlRaw`
        INSERT INTO metrics_daily (listing_id, day, source, clicks, impressions, avg_position)
        VALUES ${sqlRaw.join(values, sqlRaw`, `)}
        ON CONFLICT (listing_id, day, source)
        DO UPDATE SET
          clicks = excluded.clicks,
          impressions = excluded.impressions,
          avg_position = excluded.avg_position
      `);

      written += batch.length;
    }

    await db
      .update(syncRuns)
      .set({ status: "ok", finishedAt: new Date(), rowsWritten: written })
      .where(eq(syncRuns.id, run.id));

    return { ok: true, totalRows: rows.length, written, skippedNoMatch };
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
