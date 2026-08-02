import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  product_id: string;
  name: string;
  series_name: string | null;
  views: number;
  sessions: number;
  impressions: number;
  clicks: number;
  avg_position: string | null;
  order_count: number;
  gross: string;
};

async function getProductViews() {
  const result = await db.execute<Row>(sql`
    select
      l.product_id as product_id,
      p.internal_name as name,
      s.name as series_name,
      coalesce(sum(pv.views), 0)::int as views,
      coalesce(sum(pv.sessions), 0)::int as sessions,
      coalesce(sum(gsc.impressions), 0)::int as impressions,
      coalesce(sum(gsc.clicks), 0)::int as clicks,
      case when count(gsc.avg_position) > 0
        then round(avg(gsc.avg_position), 1)::text
        else null
      end as avg_position,
      count(distinct oi.id)::int as order_count,
      coalesce(sum(oi.gross), 0)::text as gross
    from listings l
    join channels c on l.channel_id = c.id and c.key = 'wix'
    join products p on l.product_id = p.id
    left join series s on p.series_id = s.id
    left join page_views_daily pv on pv.page_path = regexp_replace(l.url, '^https?://[^/]+', '')
    left join metrics_daily gsc on gsc.listing_id = l.id and gsc.source = 'gsc'
    left join order_items oi on oi.product_id = p.id
    where l.url is not null
    group by l.product_id, p.internal_name, s.name
    order by sum(pv.views) desc nulls last
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function AnalyticsPage() {
  const rows = await getProductViews();

  const withViews = rows.filter((r) => r.views > 0);
  const avgConversion =
    withViews.length > 0
      ? withViews.reduce((sum, r) => sum + (r.order_count / Math.max(r.views, 1)) * 100, 0) / withViews.length
      : 0;

  const needsAttention = withViews
    .map((r) => ({ ...r, conversion: (r.order_count / Math.max(r.views, 1)) * 100 }))
    .filter((r) => r.views >= 10 && r.conversion < avgConversion * 0.5)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const GRID = "1.8fr 0.9fr 0.6fr 0.7fr 0.6fr 0.6fr 0.6fr 0.7fr 0.8fr";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Analytics
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            GA4 page views + Search Console clicks and rankings, matched to real products ·{" "}
            {withViews.length} products with GA4 traffic
          </p>
        </div>

        {needsAttention.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Needs attention — high views, low conversion
            </div>
            <div style={{ background: "var(--bg-warning)", border: "0.5px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  padding: "10px 16px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  borderBottom: "0.5px solid var(--border)",
                  minWidth: 900,
                }}
              >
                <div>Product</div>
                <div>Series</div>
                <div>Views</div>
                <div>Impr.</div>
                <div>Clicks</div>
                <div>Pos.</div>
                <div>Orders</div>
                <div>Conv.</div>
                <div>Revenue</div>
              </div>
              {needsAttention.map((row, i) => (
                <Link
                  key={row.product_id}
                  href={`/products/${row.product_id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID,
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < needsAttention.length - 1 ? "0.5px solid var(--border)" : "none",
                      fontSize: 12,
                      minWidth: 900,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)" }}>{row.name}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.views}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.impressions || "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.clicks || "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.avg_position ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.order_count}</div>
                    <div style={{ color: "var(--text-warning)" }}>{row.conversion.toFixed(1)}%</div>
                    <div style={{ color: "var(--text-primary)" }}>{formatMoney(row.gross)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          All products by views · shop average conversion {avgConversion.toFixed(1)}%
        </div>
        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-muted)",
              borderBottom: "0.5px solid var(--border)",
              minWidth: 900,
            }}
          >
            <div>Product</div>
            <div>Series</div>
            <div>Views</div>
            <div>Impr.</div>
            <div>Clicks</div>
            <div>Pos.</div>
            <div>Orders</div>
            <div>Conv.</div>
            <div>Revenue</div>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
              No page view data matched yet.
            </div>
          ) : (
            rows.map((row, i) => {
              const conversion = row.views > 0 ? (row.order_count / row.views) * 100 : null;
              return (
                <Link
                  key={row.product_id}
                  href={`/products/${row.product_id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID,
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < rows.length - 1 ? "0.5px solid var(--border)" : "none",
                      fontSize: 12,
                      minWidth: 900,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)" }}>{row.name}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.views}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.impressions || "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.clicks || "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.avg_position ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.order_count}</div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {conversion != null ? `${conversion.toFixed(1)}%` : "—"}
                    </div>
                    <div style={{ color: "var(--text-primary)" }}>{formatMoney(row.gross)}</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
