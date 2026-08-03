import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
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
    select coalesce(sum(gross), 0)::text as gross, coalesce(sum(net), 0)::text as net, count(*)::int as order_count
    from orders where ordered_at::date between ${startDate} and ${endDate}
  `);
  return result.rows[0] ?? { gross: "0", net: "0", order_count: 0 };
}

async function getCustomerCount(startDate: string, endDate: string) {
  const result = await db.execute<{ count: number }>(sql`
    select count(distinct customer_id)::int as count from orders
    where ordered_at::date between ${startDate} and ${endDate} and customer_id is not null
  `);
  return result.rows[0]?.count ?? 0;
}

async function getConversion(startDate: string, endDate: string) {
  const sessionsResult = await db.execute<{ sessions: number }>(sql`
    select coalesce(sum(sessions), 0)::int as sessions from page_views_daily where day between ${startDate} and ${endDate}
  `);
  const sessions = sessionsResult.rows[0]?.sessions ?? 0;
  const totals = await getTotals(startDate, endDate);
  const reliable = sessions >= totals.order_count && sessions > 0;
  const rate = reliable ? (totals.order_count / sessions) * 100 : null;
  return { rate, sessions, orders: totals.order_count, reliable };
}

async function getWeeklyInsight() {
  const today = new Date();
  const last7Start = ymd(new Date(today.getTime() - 7 * 86400000));
  const prev7Start = ymd(new Date(today.getTime() - 14 * 86400000));
  const prev7End = ymd(new Date(today.getTime() - 8 * 86400000));
  const [last7, prev7] = await Promise.all([getTotals(last7Start, ymd(today)), getTotals(prev7Start, prev7End)]);
  const lastGross = Number(last7.gross);
  const prevGross = Number(prev7.gross);
  const pctChange = prevGross > 0 ? ((lastGross - prevGross) / prevGross) * 100 : lastGross > 0 ? 100 : 0;
  return {
    date: today.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }),
    pctChange,
    direction: pctChange >= 0 ? "increased" : "decreased",
  };
}

type MonthBar = { month: string; label: string; gross: number; tier: "good" | "normal" | "bad" };

async function getCalendarYearBars(endDate: string): Promise<MonthBar[]> {
  const year = new Date(endDate).getUTCFullYear();
  const result = await db.execute<{ month: string; gross: string }>(sql`
    select to_char(date_trunc('month', ordered_at), 'YYYY-MM') as month, coalesce(sum(gross), 0)::text as gross
    from orders
    where date_part('year', ordered_at) = ${year}
    group by date_trunc('month', ordered_at)
  `);
  const byMonth = new Map(result.rows.map((r) => [r.month, Number(r.gross)]));
  const months: { month: string; label: string; gross: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "short" });
    months.push({ month: key, label, gross: byMonth.get(key) ?? 0 });
  }
  const nonZero = months.filter((m) => m.gross > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((s, m) => s + m.gross, 0) / nonZero.length : 0;
  return months.map((m) => ({
    ...m,
    tier: m.gross === 0 ? "normal" : m.gross >= avg * 1.1 ? "good" : m.gross <= avg * 0.9 ? "bad" : "normal",
  }));
}

async function getTopClients(startDate: string, endDate: string, range: string) {
  const result = await db.execute<{ id: string; name: string | null; email: string | null; order_count: number; gross: string }>(sql`
    select c.id, c.name, c.email, count(o.id)::int as order_count, coalesce(sum(o.gross), 0)::text as gross
    from customers c join orders o on o.customer_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.id order by sum(o.gross) desc limit 5
  `);
  if (range === "all" || result.rows.length === 0) {
    return result.rows.map((r) => ({ ...r, growth: null as number | null }));
  }
  const prior = priorPeriod(startDate, endDate);
  const priorResult = await db.execute<{ id: string; gross: string }>(sql`
    select c.id, coalesce(sum(o.gross), 0)::text as gross from customers c
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
    order_id: string; order_number: string | null; external_order_id: string | null;
    customer_name: string | null; customer_email: string | null; item_count: number; gross: string;
  }>(sql`
    select o.id as order_id, o.order_number, o.external_order_id,
      cu.name as customer_name, cu.email as customer_email,
      (select count(*)::int from order_items oi where oi.order_id = o.id) as item_count, o.gross::text as gross
    from orders o left join customers cu on o.customer_id = cu.id
    order by o.ordered_at desc limit 5
  `).then((r) => r.rows);
}

async function getTopProductsByChannel(startDate: string, endDate: string, channelKey: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select p.internal_name as name, coalesce(sum(oi.gross), 0)::text as gross
    from order_items oi
    join orders o on oi.order_id = o.id and o.ordered_at::date between ${startDate} and ${endDate}
    join channels c on o.channel_id = c.id and c.key = ${channelKey}
    join products p on oi.product_id = p.id
    group by p.id, p.internal_name order by sum(oi.gross) desc limit 3
  `);
  return result.rows;
}

async function getSalesByPlatform(startDate: string, endDate: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select c.name, coalesce(sum(o.gross), 0)::text as gross from channels c
    left join orders o on o.channel_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.name order by sum(o.gross) desc nulls last
  `);
  return result.rows;
}

async function getSalesBySource(startDate: string, endDate: string) {
  const result = await db.execute<{ source: string; sessions: number }>(sql`
    select source, sum(sessions)::int as sessions from traffic_source_daily
    where day between ${startDate} and ${endDate} group by source order by sum(sessions) desc
  `);
  const total = result.rows.reduce((s, r) => s + r.sessions, 0);
  return { rows: result.rows, total };
}

async function getFavoriteProduct(startDate: string, endDate: string) {
  const result = await db.execute<{ product_id: string; name: string; gross: string; cover_url: string | null }>(sql`
    select p.id as product_id, p.internal_name as name, coalesce(sum(oi.gross), 0)::text as gross,
      (select a.url from assets a where a.product_id = p.id and a.kind = 'cover' limit 1) as cover_url
    from order_items oi join orders o on oi.order_id = o.id and o.ordered_at::date between ${startDate} and ${endDate}
    join products p on oi.product_id = p.id
    group by p.id, p.internal_name order by sum(oi.gross) desc limit 1
  `);
  return result.rows[0] ?? null;
}

const SOURCE_COLORS: Record<string, string> = {
  Direct: "#AFD44F", Pinterest: "#467262", Instagram: "#E0A14D", Google: "#3B6D11", Facebook: "#A69F4F", Other: "#8A867B",
};

const CARD_BG = "#EDEDE4";
const UPDATE_BG = "#E6E7B7";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C2A26" strokeWidth={1.6}>
      {children}
    </svg>
  );
}
const HEART = <Icon><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
const COIN = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12h6M12 9v6" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
const SMILEY = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" /><line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" /><line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" /></Icon>;
const TARGET = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="4.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="1" fill="#2C2A26" /></Icon>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; ym?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { range, startDate, endDate, label } = resolveRange(sp);

  const [totals, customerCount, conversion, insight, monthlyBars, topClients, latestOrders, wixTop, gumroadTop, byPlatform, bySource, favoriteProduct] =
    await Promise.all([
      getTotals(startDate, endDate),
      getCustomerCount(startDate, endDate),
      getConversion(startDate, endDate),
      getWeeklyInsight(),
      getCalendarYearBars(endDate),
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
  const yAxisSteps = [1, 0.8, 0.6, 0.4, 0.2, 0];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F2F3EE" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px", display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 30, color: "#2C2A26", margin: 0 }}>Dashboard</h1>
              <p style={{ fontSize: 13, color: "#8A867B", marginTop: 4 }}>
                Showing {label === "All Time" ? "all time" : label} across all four channels.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/" style={{ padding: "7px 18px", borderRadius: 12, fontSize: 13, textDecoration: "none", background: range === "all" ? UPDATE_BG : "transparent", border: range === "all" ? "none" : "1px solid #D8D8C7", color: "#2C2A26" }}>
                All Time
              </Link>
              <Link href="/?range=month" style={{ padding: "7px 18px", borderRadius: 12, fontSize: 13, textDecoration: "none", background: range === "month" ? UPDATE_BG : "transparent", border: range === "month" ? "none" : "1px solid #D8D8C7", color: "#2C2A26" }}>
                Select Month
              </Link>
              <span style={{ padding: "7px 18px", borderRadius: 12, fontSize: 13, border: "1px solid #D8D8C7", color: "#8A867B" }}>
                Custom Range
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            <div style={{ background: UPDATE_BG, borderRadius: 22, padding: 20, aspectRatio: "1", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{HEART}<span style={{ fontSize: 14, color: "#2C2A26" }}>Update</span></div>
              <div style={{ fontSize: 12, color: "#6B6B55" }}>{insight.date}</div>
              <div style={{ fontSize: 14, color: "#2C2A26", marginTop: 6, flex: 1 }}>
                Sales revenue {insight.direction}{" "}
                <span style={{ color: "#3B6D11" }}>{Math.abs(insight.pctChange).toFixed(0)}%</span> in 1 week
              </div>
            </div>
            <div style={{ background: CARD_BG, borderRadius: 22, padding: 20, aspectRatio: "1", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{COIN}<span style={{ fontSize: 14, color: "#2C2A26" }}>Net Income</span></div>
              <div style={{ fontSize: 30, color: "#2C2A26", marginTop: "auto", marginBottom: "auto" }}>{formatMoney(totals.net)}</div>
            </div>
            <div style={{ background: CARD_BG, borderRadius: 22, padding: 20, aspectRatio: "1", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{SMILEY}<span style={{ fontSize: 14, color: "#2C2A26" }}>Customers</span></div>
              <div style={{ fontSize: 30, color: "#2C2A26", marginTop: "auto", marginBottom: "auto" }}>{customerCount.toLocaleString()}</div>
            </div>
            <div style={{ background: CARD_BG, borderRadius: 22, padding: 20, aspectRatio: "1", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{TARGET}<span style={{ fontSize: 14, color: "#2C2A26" }}>Conversion</span></div>
              <div style={{ fontSize: 30, color: "#2C2A26", marginTop: "auto" }}>{conversion.reliable ? `${conversion.rate!.toFixed(1)}%` : "—"}</div>
              <div style={{ fontSize: 11, color: "#8A867B" }}>
                {conversion.reliable ? `${conversion.orders} orders / ${conversion.sessions} sessions` : "GA4 traffic data still syncing"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "1 / span 3", background: CARD_BG, borderRadius: 22, padding: 24 }}>
              <div style={{ fontSize: 16, color: "#2C2A26", marginBottom: 4 }}>Sales Report</div>
              <div style={{ fontSize: 26, color: "#2C2A26", marginBottom: 20 }}>{formatMoney(totals.gross)}</div>
              <div style={{ display: "flex" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 180, paddingRight: 8, fontSize: 10, color: "#8A867B" }}>
                  {yAxisSteps.map((s) => (
                    <span key={s}>{s === 0 ? "$0" : `$${Math.round((maxBarGross * s) / 100) * 100}`}</span>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8, height: 180, borderLeft: "1px solid #D8D8C7", paddingLeft: 12 }}>
                  {monthlyBars.map((m) => (
                    <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: "60%", height: `${Math.max(4, (m.gross / maxBarGross) * 160)}px`, background: tierColor[m.tier], borderRadius: 8 }} title={formatMoney(m.gross)} />
                      <span style={{ fontSize: 10, color: "#8A867B" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ gridColumn: "4 / span 1", background: CARD_BG, borderRadius: 22, padding: 20 }}>
              <div style={{ fontSize: 15, color: "#2C2A26", marginBottom: 14 }}>Top Clients</div>
              {topClients.length === 0 ? (
                <p style={{ fontSize: 12, color: "#8A867B" }}>No orders in this range.</p>
              ) : (
                topClients.map((c) => (
                  <Link key={c.id} href={`/customers/${c.id}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ padding: "8px 0", borderBottom: "1px solid #D8D8C7" }}>
                      <div style={{ fontSize: 12, color: "#2C2A26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || c.email || "Unknown"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: "#8A867B" }}>{c.order_count} orders</span>
                        <span style={{ fontSize: 12, color: "#2C2A26" }}>{formatMoney(c.gross)}</span>
                      </div>
                      {c.growth != null && (
                        <div style={{ fontSize: 10, color: c.growth >= 0 ? "#3B6D11" : "#DE9E4D", textAlign: "right" }}>
                          {c.growth >= 0 ? "+" : ""}{c.growth.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ gridColumn: "1 / span 2", background: CARD_BG, borderRadius: 22, padding: 24 }}>
              <div style={{ fontSize: 16, color: "#2C2A26", marginBottom: 14 }}>Latest Orders</div>
              {latestOrders.map((o) => (
                <div key={o.order_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #D8D8C7", fontSize: 12 }}>
                  <span style={{ color: "#8A867B" }}>{o.order_number ? `#${o.order_number}` : (o.external_order_id ?? "—").slice(0, 8)}</span>
                  <span style={{ color: "#2C2A26" }}>{o.customer_name || o.customer_email || "Unknown"}</span>
                  <span style={{ color: "#8A867B" }}>{o.item_count} items</span>
                  <span style={{ color: "#2C2A26" }}>{formatMoney(o.gross)}</span>
                </div>
              ))}
            </div>
            <div style={{ gridColumn: "3 / span 2", background: CARD_BG, borderRadius: 22, padding: 24 }}>
              <div style={{ fontSize: 16, color: "#2C2A26", marginBottom: 14 }}>Top Products</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#2C2A26", marginBottom: 8 }}>Wix Studio</div>
                  {wixTop.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#8A867B", padding: "4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} · {formatMoney(p.gross)}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#2C2A26", marginBottom: 8 }}>Gumroad</div>
                  {gumroadTop.map((p, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#8A867B", padding: "4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} · {formatMoney(p.gross)}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: 235, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ fontSize: 15, color: "#2C2A26", marginBottom: 14 }}>Sales by Source</div>
            {bySource.total === 0 ? (
              <p style={{ fontSize: 12, color: "#8A867B" }}>No traffic source data synced yet.</p>
            ) : (
              <>
                <div
                  style={{
                    width: 160, height: 160, borderRadius: "50%", margin: "0 auto 14px", position: "relative",
                    background: `conic-gradient(${bySource.rows
                      .reduce((acc, r, i) => {
                        const pct = (r.sessions / bySource.total) * 100;
                        const start = acc.cum;
                        acc.cum += pct;
                        acc.parts.push(`${SOURCE_COLORS[r.source] ?? "#8A867B"} ${start}% ${acc.cum}%`);
                        return acc;
                      }, { cum: 0, parts: [] as string[] }).parts.join(", ")})`,
                  }}
                >
                  <div style={{ position: "absolute", inset: 24, borderRadius: "50%", background: "#F2F3EE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, color: "#8A867B" }}>Sessions</span>
                    <span style={{ fontSize: 16, color: "#2C2A26" }}>{bySource.total.toLocaleString()}</span>
                  </div>
                </div>
                {bySource.rows.map((r) => (
                  <div key={r.source} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#2C2A26" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: SOURCE_COLORS[r.source] ?? "#8A867B" }} />
                      {r.source}
                    </span>
                    <span style={{ color: "#8A867B" }}>{((r.sessions / bySource.total) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div>
            <div style={{ fontSize: 15, color: "#2C2A26", marginBottom: 10 }}>Sales by Platform</div>
            {byPlatform.map((p) => (
              <div key={p.name} style={{ background: CARD_BG, borderRadius: 10, padding: "9px 14px", display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: "#2C2A26" }}>{p.name}</span>
                <span style={{ color: "#2C2A26" }}>{formatMoney(p.gross)}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 15, color: "#2C2A26", marginBottom: 10 }}>Favorite Product</div>
            {favoriteProduct ? (
              <Link href={`/products/${favoriteProduct.product_id}`} style={{ textDecoration: "none" }}>
                {favoriteProduct.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={favoriteProduct.cover_url} alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 9, marginBottom: 10 }} />
                ) : (
                  <div style={{ width: "100%", height: 200, borderRadius: 9, marginBottom: 10, background: "linear-gradient(135deg, #C1653B, #A8522E)" }} />
                )}
                <div style={{ fontSize: 12, color: "#2C2A26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{favoriteProduct.name}</div>
                <div style={{ fontSize: 12, color: "#A8522E", marginTop: 2 }}>{formatMoney(favoriteProduct.gross)}</div>
              </Link>
            ) : (
              <p style={{ fontSize: 12, color: "#8A867B" }}>No sales in this range yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
