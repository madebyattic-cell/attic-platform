import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

type StatsRow = {
  total_customers: number;
  repeat_customers: number;
  avg_ltv: string;
};

type CustomerRow = {
  id: string;
  email: string | null;
  name: string | null;
  country: string | null;
  order_count: number;
  first_order_at: string | null;
  last_order_at: string | null;
  lifetime_net: string;
};

type CountryRow = {
  country: string;
  customer_count: number;
  revenue: string;
};

async function getStats() {
  const result = await db.execute<StatsRow>(sql`
    select
      count(distinct c.id)::int as total_customers,
      count(distinct c.id) filter (where c.order_count > 1)::int as repeat_customers,
      coalesce(avg(t.net_sum), 0)::text as avg_ltv
    from customers c
    left join (
      select customer_id, sum(net) as net_sum
      from orders
      where customer_id is not null
      group by customer_id
    ) t on t.customer_id = c.id
  `);
  return result.rows[0] ?? { total_customers: 0, repeat_customers: 0, avg_ltv: "0" };
}

async function getTopCustomers() {
  const result = await db.execute<CustomerRow>(sql`
    select
      c.id,
      c.email,
      c.name,
      c.country,
      c.order_count,
      c.first_order_at::text as first_order_at,
      c.last_order_at::text as last_order_at,
      coalesce(sum(o.net), 0)::text as lifetime_net
    from customers c
    left join orders o on o.customer_id = c.id
    group by c.id
    order by sum(o.net) desc nulls last
    limit 30
  `);
  return result.rows;
}

async function getByCountry() {
  const result = await db.execute<CountryRow>(sql`
    select
      coalesce(c.country, 'Unknown') as country,
      count(distinct c.id)::int as customer_count,
      coalesce(sum(o.net), 0)::text as revenue
    from customers c
    left join orders o on o.customer_id = c.id
    group by coalesce(c.country, 'Unknown')
    order by sum(o.net) desc nulls last
    limit 12
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default async function CustomersPage() {
  const [stats, topCustomers, byCountry] = await Promise.all([
    getStats(),
    getTopCustomers(),
    getByCountry(),
  ]);

  const repeatRate =
    stats.total_customers > 0 ? (stats.repeat_customers / stats.total_customers) * 100 : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Customers
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {stats.total_customers.toLocaleString()} total customers
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Total customers</div>
            <div style={{ fontSize: 20, color: "var(--text-primary)" }}>
              {stats.total_customers.toLocaleString()}
            </div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Repeat buyer rate</div>
            <div style={{ fontSize: 20, color: "var(--text-accent)" }}>{repeatRate.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {stats.repeat_customers.toLocaleString()} bought more than once
            </div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Avg lifetime value</div>
            <div style={{ fontSize: 20, color: "var(--text-primary)" }}>{formatMoney(stats.avg_ltv)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Top customers by lifetime value</div>
            <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 0.7fr 0.9fr 0.9fr 0.9fr",
                  padding: "10px 16px",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <div>Customer</div>
                <div>Orders</div>
                <div>First order</div>
                <div>Last order</div>
                <div>Lifetime</div>
              </div>
              {topCustomers.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No customers yet.</div>
              ) : (
                topCustomers.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 0.7fr 0.9fr 0.9fr 0.9fr",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < topCustomers.length - 1 ? "0.5px solid var(--border)" : "none",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name || c.email || "Unknown"}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {c.country ?? "—"}
                      </div>
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>{c.order_count}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{formatDate(c.first_order_at)}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{formatDate(c.last_order_at)}</div>
                    <div style={{ color: "var(--text-primary)" }}>{formatMoney(c.lifetime_net)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>By country</div>
            <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              {byCountry.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No data yet.</div>
              ) : (
                byCountry.map((row, i) => (
                  <div
                    key={row.country}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 16px",
                      borderBottom: i < byCountry.length - 1 ? "0.5px solid var(--border)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{row.country}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {row.customer_count} customer{row.customer_count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{formatMoney(row.revenue)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
