import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

type SeriesRow = {
  series_id: string | null;
  series_name: string;
  product_count: number;
  order_count: number;
  gross: string;
  avg_order_value: string;
};

async function getSeriesPerformance() {
  const result = await db.execute<SeriesRow>(sql`
    select
      s.id as series_id,
      coalesce(s.name, 'No series') as series_name,
      count(distinct p.id)::int as product_count,
      count(oi.id)::int as order_count,
      coalesce(sum(oi.gross), 0)::text as gross,
      case when count(oi.id) > 0
        then (coalesce(sum(oi.gross), 0) / count(oi.id))::text
        else '0'
      end as avg_order_value
    from products p
    left join series s on p.series_id = s.id
    left join order_items oi on oi.product_id = p.id
    group by s.id, s.name
    order by sum(oi.gross) desc nulls last
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function SeriesPerformancePage() {
  const rows = await getSeriesPerformance();
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.gross), 0);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Series performance
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {rows.length} series · {formatMoney(totalRevenue)} total revenue
          </p>
        </div>

        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1fr",
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-muted)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <div>Series</div>
            <div>Products</div>
            <div>Orders</div>
            <div>Revenue</div>
            <div>Avg order</div>
            <div>Share</div>
          </div>
          {rows.map((row, i) => {
            const gross = Number(row.gross);
            const share = totalRevenue > 0 ? (gross / totalRevenue) * 100 : 0;
            return (
              <div
                key={row.series_id ?? "none"}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1fr",
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: i < rows.length - 1 ? "0.5px solid var(--border)" : "none",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--text-primary)" }}>{row.series_name}</div>
                <div style={{ color: "var(--text-secondary)" }}>{row.product_count}</div>
                <div style={{ color: "var(--text-secondary)" }}>{row.order_count}</div>
                <div style={{ color: "var(--text-primary)" }}>{formatMoney(row.gross)}</div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {row.order_count > 0 ? formatMoney(row.avg_order_value) : "—"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--surface-1)", borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${share}%`,
                        height: "100%",
                        background: "var(--text-accent)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", width: 32 }}>
                    {share.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
