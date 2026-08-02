import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

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

const countryDisplay = new Intl.DisplayNames(["en"], { type: "region" });

function fullCountryName(raw: string | null): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  if (trimmed.length === 2) {
    try {
      const name = countryDisplay.of(trimmed.toUpperCase());
      if (name) return name;
    } catch {
      // fall through to raw value below
    }
  }
  return trimmed;
}

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

async function getAllCustomers() {
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
  const [stats, customers] = await Promise.all([getStats(), getAllCustomers()]);

  const repeatRate =
    stats.total_customers > 0 ? (stats.repeat_customers / stats.total_customers) * 100 : 0;

  // Country aggregation computed here, after normalizing to full names, so
  // "US" and "United States" (if both appear raw) merge into one bucket.
  const byCountryMap = new Map<string, { customerCount: number; revenue: number }>();
  for (const c of customers) {
    const name = fullCountryName(c.country);
    const existing = byCountryMap.get(name) ?? { customerCount: 0, revenue: 0 };
    existing.customerCount += 1;
    existing.revenue += Number(c.lifetime_net);
    byCountryMap.set(name, existing);
  }
  const byCountry = Array.from(byCountryMap.entries())
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

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
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              All customers ({customers.length.toLocaleString()})
            </div>
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
              {customers.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No customers yet.</div>
              ) : (
                customers.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/customers/${c.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 0.7fr 0.9fr 0.9fr 0.9fr",
                        alignItems: "center",
                        padding: "10px 16px",
                        borderBottom: i < customers.length - 1 ? "0.5px solid var(--border)" : "none",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name || c.email || "Unknown"}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                          {fullCountryName(c.country)}
                        </div>
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>{c.order_count}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{formatDate(c.first_order_at)}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{formatDate(c.last_order_at)}</div>
                      <div style={{ color: "var(--text-primary)" }}>{formatMoney(c.lifetime_net)}</div>
                    </div>
                  </Link>
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
                        {row.customerCount} customer{row.customerCount === 1 ? "" : "s"}
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
