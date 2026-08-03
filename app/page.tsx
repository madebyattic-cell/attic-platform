import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ANALYTICS_TABS } from "@/components/nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveRange(sp: { range?: string; ym?: string; from?: string; to?: string }) {
  const range = sp.range === "month" || sp.range === "custom" ? sp.range : "all";
  const today = new Date();

  if (range === "custom" && sp.from && sp.to) {
    return { range, startDate: sp.from, endDate: sp.to, label: `${sp.from} – ${sp.to}` };
  }

  if (range === "month") {
    const ym = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { range, startDate: ymd(start), endDate: ymd(end), label: ym };
  }

  return { range: "all" as const, startDate: "2000-01-01", endDate: ymd(today), label: "All Time" };
}

// The immediately preceding period of equal length — used for growth %.
// Not meaningful for "All Time", so callers should skip it in that case.
function priorPeriod(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const lengthMs = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - lengthMs);
  return { startDate: ymd(priorStart), endDate: ymd(priorEnd) };
}

async function getTotals(startDate: string, endDate: string) {
  const result = await db.execute<{ gross: string; net: string; order_count: number }>(sql`
    select
      coalesce(sum(gross), 0)::text as gross,
      coalesce(sum(net), 0)::text as net,
      count(*)::int as order_count
    from orders
    where ordered_at::date between ${startDate} and ${endDate}
  `);
  return result.rows[0] ?? { gross: "0", net: "0", order_count: 0 };
}

async function getCustomerCount(startDate: string, endDate: string) {
  const result = await db.execute<{ count: number }>(sql`
    select count(distinct customer_id)::int as count
    from orders
    where ordered_at::date between ${startDate} and ${endDate}
      and customer_id is not null
  `);
  return result.rows[0]?.count ?? 0;
}

async function getConversion(startDate: string, endDate: string) {
  const sessionsResult = await db.execute<{ sessions: number }>(sql`
    select coalesce(sum(sessions), 0)::int as sessions
    from page_views_daily
    where day between ${startDate} and ${endDate}
  `);
  const sessions = sessionsResult.rows[0]?.sessions ?? 0;
  const totals = await getTotals(startDate, endDate);
  const rate = sessions > 0 ? (totals.order_count / sessions) * 100 : 0;
  return { rate, sessions, orders: totals.order_count };
}

// Real, calculated — last 7 days vs the 7 days before that, independent of
// whatever date range is selected on the picker, since this is meant to
// surface a genuinely recent signal.
async function getWeeklyInsight() {
  const today = new Date();
  const last7Start = ymd(new Date(today.getTime() - 7 * 86400000));
  const last7End = ymd(today);
  const prev7Start = ymd(new Date(today.getTime() - 14 * 86400000));
  const prev7End = ymd(new Date(today.getTime() - 8 * 86400000));

  const [last7, prev7] = await Promise.all([getTotals(last7Start, last7End), getTotals(prev7Start, prev7End)]);
  const lastGross = Number(last7.gross);
  const prevGross = Number(prev7.gross);
  const pctChange = prevGross > 0 ? ((lastGross - prevGross) / prevGross) * 100 : lastGross > 0 ? 100 : 0;

  return {
    date: today.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }),
    pctChange,
    direction: pctChange >= 0 ? "increased" : "decreased",
  };
}

type MonthBar = { month: string; gross: number; tier: "good" | "normal" | "bad" };

async function getMonthlyBars(endDate: string): Promise<MonthBar[]> {
  const end = new Date(endDate);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));

  const result = await db.execute<{ month: string; gross: string }>(sql`
    select to_char(date_trunc('month', ordered_at), 'YYYY-MM') as month, coalesce(sum(gross), 0)::text as gross
    from orders
    where ordered_at >= ${ymd(start)}
    group by date_trunc('month', ordered_at)
  `);

  const byMonth = new Map(result.rows.map((r) => [r.month, Number(r.gross)]));
  const months: { month: string; gross: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, gross: byMonth.get(key) ?? 0 });
  }

  const avg = months.reduce((s, m) => s + m.gross, 0) / (months.length || 1);
  return months.map((m) => ({
    ...m,
    tier: m.gross >= avg * 1.1 ? "good" : m.gross <= avg * 0.9 ? "bad" : "normal",
  }));
}

async function getTopClients(startDate: string, endDate: string, range: string) {
  const result = await db.execute<{ id: string; name: string | null; email: string | null; order_count: number; gross: string }>(sql`
    select c.id, c.name, c.email, count(o.id)::int as order_count, coalesce(sum(o.gross), 0)::text as gross
    from customers c
    join orders o on o.customer_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.id
    order by sum(o.gross) desc
    limit 5
  `);

  if (range === "all" || result.rows.length === 0) {
    return result.rows.map((r) => ({ ...r, growth: null as number | null }));
  }

  const prior = priorPeriod(startDate, endDate);
  const priorResult = await db.execute<{ id: string; gross: string }>(sql`
    select c.id, coalesce(sum(o.gross), 0)::text as gross
    from customers c
    join orders o on o.customer_id = c.id and o.ordered_at::date between ${prior.startDate} and ${prior.endDate}
    where c.id in (${sql.join(result.rows.map((r) => sql`${r.id}`), sql`, `)})
    group by c.id
  `);
  const priorByCustomer = new Map(priorResult.rows.map((r) => [r.id, Number(r.gross)]));

  return result.rows.map((r) => {
    const currentGross = Number(r.gross);
    const priorGross = priorByCustomer.get(r.id) ?? 0;
    const growth = priorGross > 0 ? ((currentGross - priorGross) / priorGross) * 100 : currentGross > 0 ? 100 : 0;
    return { ...r, growth };
  });
}

async function getLatestOrders() {
  return db.execute<{
    order_id: string;
    order_number: string | null;
    external_order_id: string | null;
    ordered_at: string;
    customer_name: string | null;
    customer_email: string | null;
    item_count: number;
    gross: string;
  }>(sql`
    select
      o.id as order_id, o.order_number, o.external_order_id, o.ordered_at::text as ordered_at,
      cu.name as customer_name, cu.email as customer_email,
      (select count(*)::int from order_items oi where oi.order_id = o.id) as item_count,
      o.gross::text as gross
    from orders o
    left join customers cu on o.customer_id = cu.id
    order by o.ordered_at desc
    limit 6
  `).then((r) => r.rows);
}

async function getTopProductsByChannel(startDate: string, endDate: string, channelKey: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select p.internal_name as name, coalesce(sum(oi.gross), 0)::text as gross
    from order_items oi
    join orders o on oi.order_id = o.id and o.ordered_at::date between ${startDate} and ${endDate}
    join channels c on o.channel_id = c.id and c.key = ${channelKey}
    join products p on oi.product_id = p.id
    group by p.id, p.internal_name
    order by sum(oi.gross) desc
    limit 3
  `);
  return result.rows;
}

async function getSalesByPlatform(startDate: string, endDate: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select c.name, coalesce(sum(o.gross), 0)::text as gross
    from channels c
    left join orders o on o.channel_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.name
    order by sum(o.gross) desc nulls last
  `);
  return result.rows;
}

async function getSalesBySource(startDate: string, endDate: string) {
  const result = await db.execute<{ source: string; sessions: number }>(sql`
    select source, sum(sessions)::int as sessions
    from traffic_source_daily
    where day between ${startDate} and ${endDate}
    group by source
    order by sum(sessions) desc
  `);
  const total = result.rows.reduce((s, r) => s + r.sessions, 0);
  return { rows: result.rows, total };
}

async function getFavoriteProduct(startDate: string, endDate: string) {
  const result = await db.execute<{ product_id: string; name: string; gross: string; cover_url: string | null }>(sql`
    select p.id as product_id, p.internal_name as name, coalesce(sum(oi.gross), 0)::text as gross,
      (select a.url from assets a where a.product_id = p.id and a.kind = 'cover' limit 1) as cover_url
    from order_items oi
    join orders o on oi.order_id = o.id and o.ordered_at::date between ${startDate} and ${endDate}
    join products p on oi.product_id = p.id
    group by p.id, p.internal_name
    order by sum(oi.gross) desc
    limit 1
  `);
  return result.rows[0] ?? null;
}

const SOURCE_COLORS: Record<string, string> = {
  Direct: "#AFD44F",
  Pinterest: "#467262",
  Instagram: "#DE9E4D",
  Google: "#3B6D11",
  Facebook: "#A69F4F",
  Other: "#8A867B",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; ym?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { range, startDate, endDate, label } = resolveRange(sp);

  const [
    totals,
    customerCount,
    conversion,
    insight,
    monthlyBars,
    topClients,
    latestOrders,
    wixTop,
    gumroadTop,
    byPlatform,
    bySource,
    favoriteProduct,
  ] = await Promise.all([
    getTotals(startDate, endDate),
    getCustomerCount(startDate, endDate),
    getConversion(startDate, endDate),
    getWeeklyInsight(),
    getMonthlyBars(endDate),
    getTopClients(startDate, endDate, range),
    getLatestOrders(),
    getTopProductsByChannel(startDate, endDate, "wix"),
    getTopProductsByChannel(startDate, endDate, "gumroad"),
    getSalesByPlatform(startDate, endDate),
    getSalesBySource(startDate, endDate),
    getFavoriteProduct(startDate, endDate),
  ]);

  const maxBarGross = Math.max(...monthlyBars.map((m) => m.gross), 1);
  const tierColor = { good: "#A69F4F", normal: "#D1D2BD", bad: "#DE9E4D" };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ANALYTICS_TABS} active="Shop Overview" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 26, color: "var(--text-primary)", margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Showing {label === "All Time" ? "all time" : `range ${label}`} across all channels.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13, textDecoration: "none", background: range === "all" ? "var(--surface-2)" : "transparent", border: "0.5px solid var(--border)", color: "var(--text-primary)" }}>
              All Time
            </Link>
            <Link href={`/?range=month`} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 13, textDecoration: "none", background: range === "month" ? "var(--surface-2)" : "transparent", border: "0.5px solid var(--border)", color: "var(--text-primary)" }}>
              This Month
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "#E6E7B7", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>Update</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{insight.date}</div>
            <div style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 6 }}>
              Sales revenue {insight.direction}{" "}
              <span style={{ color: insight.pctChange >= 0 ? "#3B6D11" : "#DE9E4D" }}>{Math.abs(insight.pctChange).toFixed(0)}%</span> in 1 week
            </div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>Net Income</div>
            <div style={{ fontSize: 26, color: "var(--text-primary)" }}>{formatMoney(totals.net)}</div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>Customers</div>
            <div style={{ fontSize: 26, color: "var(--text-primary)" }}>{customerCount.toLocaleString()}</div>
          </div>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>Conversion</div>
            <div style={{ fontSize: 26, color: "var(--text-primary)" }}>{conversion.rate.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{conversion.orders} orders / {conversion.sessions} sessions</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>Sales Report</div>
            <div style={{ fontSize: 24, color: "var(--text-primary)", marginBottom: 16 }}>{formatMoney(totals.gross)}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
              {monthlyBars.map((m) => (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(6, (m.gross / maxBarGross) * 140)}px`,
                      background: tierColor[m.tier],
                      borderRadius: 6,
                    }}
                    title={formatMoney(m.gross)}
                  />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 12 }}>Top Clients</div>
            {topClients.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders in this range.</p>
            ) : (
              topClients.map((c) => (
                <Link key={c.id} href={`/customers/${c.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.name || c.email || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.order_count} orders</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{formatMoney(c.gross)}</div>
                      {c.growth != null && (
                        <div style={{ fontSize: 11, color: c.growth >= 0 ? "#3B6D11" : "#DE9E4D" }}>
                          {c.growth >= 0 ? "+" : ""}{c.growth.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 12 }}>Latest Orders</div>
            {latestOrders.map((o) => (
              <div key={o.order_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--border)", fontSize: 13 }}>
                <div style={{ color: "var(--text-secondary)" }}>{o.order_number ? `#${o.order_number}` : (o.external_order_id ?? "—").slice(0, 10)}</div>
                <div style={{ color: "var(--text-primary)" }}>{o.customer_name || o.customer_email || "Unknown"}</div>
                <div style={{ color: "var(--text-secondary)" }}>{o.item_count} items</div>
                <div style={{ color: "var(--text-primary)" }}>{formatMoney(o.gross)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 12 }}>Top Products</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Wix Studio</div>
                {wixTop.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 0" }}>
                    {p.name} · {formatMoney(p.gross)}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Gumroad</div>
                {gumroadTop.map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 0" }}>
                    {p.name} · {formatMoney(p.gross)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 12 }}>Sales by Source</div>
            {bySource.total === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No traffic source data synced yet.</p>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Total sessions: {bySource.total.toLocaleString()}</div>
                {bySource.rows.map((r) => (
                  <div key={r.source} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: SOURCE_COLORS[r.source] ?? "#8A867B" }} />
                      {r.source}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>{((r.sessions / bySource.total) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 12 }}>Sales by Platform</div>
            {byPlatform.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{p.name}</span>
                <span style={{ color: "var(--text-primary)" }}>{formatMoney(p.gross)}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface-1)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 15, color: "var(--text-primary)", marginBottom: 12 }}>Favorite Product</div>
            {favoriteProduct ? (
              <Link href={`/products/${favoriteProduct.product_id}`} style={{ textDecoration: "none" }}>
                {favoriteProduct.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favoriteProduct.cover_url} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
                ) : (
                  <div style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 10, background: "linear-gradient(135deg, #C1653B, #A8522E)" }} />
                )}
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{favoriteProduct.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-accent)", marginTop: 2 }}>{formatMoney(favoriteProduct.gross)}</div>
              </Link>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No sales in this range yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
