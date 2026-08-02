import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  product_id: string;
  name: string;
  series_name: string | null;
  kind: string;
  order_count: number;
  gross: string;
};

async function getPerformance() {
  const result = await db.execute<Row>(sql`
    select
      p.id as product_id,
      p.internal_name as name,
      s.name as series_name,
      p.kind as kind,
      count(oi.id)::int as order_count,
      coalesce(sum(oi.gross), 0)::text as gross
    from products p
    left join series s on p.series_id = s.id
    left join order_items oi on oi.product_id = p.id
    where p.status = 'live'
    group by p.id, p.internal_name, s.name, p.kind
    order by sum(oi.gross) desc nulls last
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function PerformancePage() {
  const rows = await getPerformance();

  // Percentile rank by revenue among products with at least one sale —
  // more robust than min/max scaling since a couple of huge free-magnet
  // outliers won't compress everyone else toward zero.
  const withSales = rows.filter((r) => Number(r.gross) > 0 || r.order_count > 0);
  const sortedGross = [...withSales].map((r) => Number(r.gross)).sort((a, b) => a - b);

  function percentileScore(gross: number): number {
    if (sortedGross.length === 0) return 0;
    let count = 0;
    for (const g of sortedGross) {
      if (g <= gross) count++;
    }
    return Math.round((count / sortedGross.length) * 100);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Performance
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {rows.length} live products, ranked by revenue
          </p>
        </div>

        <div
          style={{
            background: "var(--surface-1)",
            border: "0.5px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          Based on sales and revenue only. Page views aren't linked to individual listings yet, so this
          doesn't show conversion rate or the Éclat-03-style "high views, low sales" pattern — that needs
          GA4 page-view data matched to each product's real URL, which isn't wired up yet.
        </div>

        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.6fr 0.8fr 1fr 0.8fr",
              padding: "10px 16px",
              fontSize: 11,
              color: "var(--text-muted)",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <div>Product</div>
            <div>Series</div>
            <div>Kind</div>
            <div>Orders</div>
            <div>Revenue</div>
            <div>Percentile</div>
          </div>
          {rows.map((row, i) => {
            const gross = Number(row.gross);
            const score = percentileScore(gross);
            return (
              <Link
                key={row.product_id}
                href={`/products/${row.product_id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 0.6fr 0.8fr 1fr 0.8fr",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderBottom: i < rows.length - 1 ? "0.5px solid var(--border)" : "none",
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: "var(--text-primary)" }}>{row.name}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.kind}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.order_count}</div>
                  <div style={{ color: "var(--text-primary)" }}>{formatMoney(row.gross)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: "var(--surface-1)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${score}%`, height: "100%", background: "var(--text-accent)" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", width: 28 }}>{score}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
