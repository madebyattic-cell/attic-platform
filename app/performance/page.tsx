import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { SALES_TABS } from "@/components/nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  product_id: string;
  name: string;
  series_name: string | null;
  kind: string;
  order_count: number;
  gross: string;
  first_known_live: string | null;
};

async function getPerformance() {
  const result = await db.execute<Row>(sql`
    with orders_agg as (
      select product_id, count(*)::int as order_count, coalesce(sum(gross), 0)::text as gross
      from order_items
      where product_id is not null
      group by product_id
    ),
    earliest_listing as (
      select product_id, min(published_at) as first_known_live
      from listings
      where published_at is not null
      group by product_id
    )
    select
      p.id as product_id,
      p.internal_name as name,
      s.name as series_name,
      p.kind as kind,
      coalesce(oa.order_count, 0) as order_count,
      coalesce(oa.gross, '0') as gross,
      el.first_known_live::text as first_known_live
    from products p
    left join series s on p.series_id = s.id
    left join orders_agg oa on oa.product_id = p.id
    left join earliest_listing el on el.product_id = p.id
    where p.status = 'live'
    order by coalesce(oa.gross::numeric, 0) desc
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "best" || sp.view === "low" ? sp.view : "all";

  const allRows = await getPerformance();
  const rows =
    view === "best"
      ? [...allRows].sort((a, b) => Number(b.gross) - Number(a.gross)).slice(0, 30)
      : view === "low"
        ? [...allRows].sort((a, b) => Number(a.gross) - Number(b.gross)).slice(0, 30)
        : allRows;
  const pageTitle = view === "best" ? "Best Selling" : view === "low" ? "Low Performing" : "Performance";

  const withScores = rows.map((r) => {
    const gross = Number(r.gross);
    let daysSinceLaunch: number | null = null;
    let revenuePerDay: number | null = null;
    if (r.first_known_live) {
      daysSinceLaunch = Math.max(
        1,
        Math.round((Date.now() - new Date(r.first_known_live).getTime()) / (1000 * 60 * 60 * 24))
      );
      revenuePerDay = gross / daysSinceLaunch;
    }
    return { ...r, daysSinceLaunch, revenuePerDay };
  });

  // Percentile is always computed against the FULL catalog, not whatever
  // subset is currently displayed — otherwise "Best Selling" would trivially
  // show everyone near 100 and "Low Performing" near 0.
  const allWithSales = allRows.filter((r) => Number(r.gross) > 0 || r.order_count > 0);
  const sortedGross = allWithSales.map((r) => Number(r.gross)).sort((a, b) => a - b);

  function percentileScore(gross: number): number {
    if (sortedGross.length === 0) return 0;
    let count = 0;
    for (const g of sortedGross) {
      if (g <= gross) count++;
    }
    return Math.round((count / sortedGross.length) * 100);
  }

  // Age-adjusted ranking, only among the products where we actually know
  // a real launch date — no fabricated dates mixed in.
  const withKnownAge = withScores.filter((r) => r.revenuePerDay != null).sort((a, b) => b.revenuePerDay! - a.revenuePerDay!);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={SALES_TABS} active={view === "best" ? "Best Selling" : view === "low" ? "Low Performing" : ""} />
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            {pageTitle}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {view === "all" ? `${rows.length} live products` : `Top ${rows.length} of ${allRows.length} live products`}
          </p>
        </div>

        {withKnownAge.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>
              Age-adjusted — revenue per day since launch ({withKnownAge.length} products with a known launch date)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
              Fairer than raw revenue when comparing an 18-month-old product to a 2-month-old one. Only shown for
              products with real, evidence-backed launch dates — no estimates.
            </div>
            <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 0.9fr 0.9fr 1fr",
                  padding: "10px 16px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <div>Product</div>
                <div>Series</div>
                <div>Days live</div>
                <div>Revenue</div>
                <div>Revenue/day</div>
              </div>
              {withKnownAge.slice(0, 20).map((row, i) => (
                <Link
                  key={row.product_id}
                  href={`/products/${row.product_id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 0.9fr 0.9fr 1fr",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < Math.min(20, withKnownAge.length) - 1 ? "0.5px solid var(--border)" : "none",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)" }}>{row.name}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.series_name ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{row.daysSinceLaunch}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{formatMoney(row.gross)}</div>
                    <div style={{ color: "var(--text-primary)" }}>{formatMoney(row.revenuePerDay!)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>All live products, by total revenue</div>
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
          Based on sales and revenue only. Percentile is relative to your own catalog, not the outside market.
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
