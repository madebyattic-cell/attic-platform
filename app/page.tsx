import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ANALYTICS_TABS } from "@/components/nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ChannelRow = {
  name: string;
  order_count: number;
  gross: string;
  net: string;
};

type ProductRow = {
  product_id: string | null;
  name: string;
  series_name: string | null;
  order_count: number;
  gross: string;
};

type TotalsRow = {
  order_count: number;
  gross: string;
  net: string;
  customer_count: number;
};

async function getDashboardData() {
  const totalsResult = await db.execute<TotalsRow>(sql`
    select
      count(distinct o.id)::int as order_count,
      coalesce(sum(o.gross), 0)::text as gross,
      coalesce(sum(o.net), 0)::text as net,
      (select count(*) from customers)::int as customer_count
    from orders o
  `);

  const byChannelResult = await db.execute<ChannelRow>(sql`
    select
      c.name as name,
      count(o.id)::int as order_count,
      coalesce(sum(o.gross), 0)::text as gross,
      coalesce(sum(o.net), 0)::text as net
    from orders o
    join channels c on c.id = o.channel_id
    group by c.name
    order by sum(o.gross) desc
  `);

  // Grouped by real product now that order attribution links to actual
  // catalog rows, instead of raw per-sale description text.
  const topProductsResult = await db.execute<ProductRow>(sql`
    select
      p.id as product_id,
      p.internal_name as name,
      s.name as series_name,
      count(*)::int as order_count,
      coalesce(sum(oi.gross), 0)::text as gross
    from order_items oi
    join products p on oi.product_id = p.id
    left join series s on p.series_id = s.id
    group by p.id, p.internal_name, s.name
    order by sum(oi.gross) desc
    limit 10
  `);

  return {
    totals: totalsResult.rows[0] ?? { order_count: 0, gross: "0", net: "0", customer_count: 0 },
    byChannel: byChannelResult.rows,
    topProducts: topProductsResult.rows,
  };
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function OverviewPage() {
  const { totals, byChannel, topProducts } = await getDashboardData();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ANALYTICS_TABS} active="Shop Overview" />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Revenue overview
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>All channels, all time</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Gross revenue</div>
            <div style={{ fontSize: 20, color: "var(--text-primary)" }}>{formatMoney(totals.gross)}</div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Net revenue</div>
            <div style={{ fontSize: 20, color: "var(--text-accent)" }}>{formatMoney(totals.net)}</div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Orders</div>
            <div style={{ fontSize: 20, color: "var(--text-primary)" }}>
              {Number(totals.order_count).toLocaleString()}
            </div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Customers</div>
            <div style={{ fontSize: 20, color: "var(--text-primary)" }}>
              {Number(totals.customer_count).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>By channel</div>
            <div
              style={{
                background: "var(--surface-2)",
                border: "0.5px solid var(--border)",
                borderRadius: 10,
                width: "100%",
              }}
            >
              {byChannel.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No orders yet.</div>
              ) : (
                byChannel.map((row, i) => (
                  <div
                    key={row.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: i < byChannel.length - 1 ? "0.5px solid var(--border)" : "none",
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {Number(row.order_count).toLocaleString()} orders
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{formatMoney(row.gross)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-accent)" }}>{formatMoney(row.net)} net</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Top products</div>
            <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              {topProducts.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No sales yet.</div>
              ) : (
                topProducts.map((row, i) => {
                  const content = (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderBottom: i < topProducts.length - 1 ? "0.5px solid var(--border)" : "none",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {row.series_name ? `${row.series_name} · ` : ""}
                          {Number(row.order_count).toLocaleString()} sold
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", flexShrink: 0 }}>
                        {formatMoney(row.gross)}
                      </div>
                    </div>
                  );
                  return row.product_id ? (
                    <Link
                      key={row.product_id}
                      href={`/products/${row.product_id}`}
                      style={{ textDecoration: "none", color: "inherit", display: "block" }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={row.name + i}>{content}</div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
