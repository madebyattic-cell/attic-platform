import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { DashboardControls } from "@/components/dashboard-controls";
import { ExpandableOrderRow } from "@/components/expandable-order-row";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function initials(name: string | null, email: string | null): string {
  const source = name || email || "?";
  const parts = source.replace(/@.*/, "").split(/[\s._]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function resolveRange(sp: { range?: string; ym?: string; from?: string; to?: string }) {
  const today = new Date();
  const r = sp.range ?? "all";

  if (r === "custom" && sp.from && sp.to) {
    return { range: "custom", startDate: sp.from, endDate: sp.to, label: `${sp.from} – ${sp.to}` };
  }
  if (r === "year") {
    return { range: "year", startDate: ymd(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))), endDate: ymd(today), label: "This Year" };
  }
  if (r === "week") {
    return { range: "week", startDate: ymd(new Date(today.getTime() - 6 * 86400000)), endDate: ymd(today), label: "This Week" };
  }
  if (r === "yesterday") {
    const y = ymd(new Date(today.getTime() - 86400000));
    return { range: "yesterday", startDate: y, endDate: y, label: "Yesterday" };
  }
  if (r === "today") {
    const t = ymd(today);
    return { range: "today", startDate: t, endDate: t, label: "Today" };
  }
  if (r === "month") {
    const ym = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { range: "month", startDate: ymd(start), endDate: ymd(end), label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  }
  return { range: "all", startDate: "2000-01-01", endDate: ymd(today), label: "All Time" };
}

function priorPeriod(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const lengthMs = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 86400000);
  const priorStart = new Date(priorEnd.getTime() - lengthMs);
  return { startDate: ymd(priorStart), endDate: ymd(priorEnd) };
}
function yoyPeriod(startDate: string, endDate: string) {
  const s = new Date(startDate); s.setUTCFullYear(s.getUTCFullYear() - 1);
  const e = new Date(endDate); e.setUTCFullYear(e.getUTCFullYear() - 1);
  return { startDate: ymd(s), endDate: ymd(e) };
}
function pctChange(current: number, prior: number): number {
  if (prior > 0) return ((current - prior) / prior) * 100;
  return current > 0 ? 100 : 0;
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
  return { rate: reliable ? (totals.order_count / sessions) * 100 : null, sessions, orders: totals.order_count, reliable };
}
async function getWeeklyInsight() {
  const today = new Date();
  const last7Start = ymd(new Date(today.getTime() - 7 * 86400000));
  const prev7Start = ymd(new Date(today.getTime() - 14 * 86400000));
  const prev7End = ymd(new Date(today.getTime() - 8 * 86400000));
  const [last7, prev7] = await Promise.all([getTotals(last7Start, ymd(today)), getTotals(prev7Start, prev7End)]);
  const change = pctChange(Number(last7.gross), Number(prev7.gross));
  return {
    date: today.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }),
    pctChange: change,
    direction: change >= 0 ? "increased" : "decreased",
    orderCountChange: pctChange(last7.order_count, prev7.order_count),
  };
}

type MonthBar = { month: string; label: string; gross: number; tier: "good" | "normal" | "bad" };
async function getCalendarYearBars(endDate: string): Promise<MonthBar[]> {
  const year = new Date(endDate).getUTCFullYear();
  const result = await db.execute<{ month: string; gross: string }>(sql`
    select to_char(date_trunc('month', ordered_at), 'YYYY-MM') as month, coalesce(sum(gross), 0)::text as gross
    from orders where date_part('year', ordered_at) = ${year} group by date_trunc('month', ordered_at)
  `);
  const byMonth = new Map(result.rows.map((r) => [r.month, Number(r.gross)]));
  const months: { month: string; label: string; gross: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    months.push({ month: key, label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "short" }), gross: byMonth.get(key) ?? 0 });
  }
  const nonZero = months.filter((m) => m.gross > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((s, m) => s + m.gross, 0) / nonZero.length : 0;
  return months.map((m) => ({ ...m, tier: m.gross === 0 ? "normal" : m.gross >= avg * 1.1 ? "good" : m.gross <= avg * 0.9 ? "bad" : "normal" }));
}

async function getTopClients(startDate: string, endDate: string, range: string) {
  const result = await db.execute<{ id: string; name: string | null; email: string | null; order_count: number; gross: string }>(sql`
    select c.id, c.name, c.email, count(o.id)::int as order_count, coalesce(sum(o.gross), 0)::text as gross
    from customers c join orders o on o.customer_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.id order by sum(o.gross) desc limit 4
  `);
  if (range === "all" || result.rows.length === 0) return result.rows.map((r) => ({ ...r, growth: null as number | null }));
  const prior = priorPeriod(startDate, endDate);
  const priorResult = await db.execute<{ id: string; gross: string }>(sql`
    select c.id, coalesce(sum(o.gross), 0)::text as gross from customers c
    join orders o on o.customer_id = c.id and o.ordered_at::date between ${prior.startDate} and ${prior.endDate}
    where c.id in (${sql.join(result.rows.map((r) => sql`${r.id}`), sql`, `)}) group by c.id
  `);
  const priorByCustomer = new Map(priorResult.rows.map((r) => [r.id, Number(r.gross)]));
  return result.rows.map((r) => ({ ...r, growth: pctChange(Number(r.gross), priorByCustomer.get(r.id) ?? 0) }));
}

async function getRapidGrowthCount(startDate: string, endDate: string, range: string) {
  if (range === "all") return null;
  const current = await db.execute<{ id: string; gross: string }>(sql`
    select c.id, sum(o.gross)::text as gross from customers c
    join orders o on o.customer_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.id
  `);
  if (current.rows.length === 0) return 0;
  const prior = priorPeriod(startDate, endDate);
  const priorResult = await db.execute<{ id: string; gross: string }>(sql`
    select c.id, sum(o.gross)::text as gross from customers c
    join orders o on o.customer_id = c.id and o.ordered_at::date between ${prior.startDate} and ${prior.endDate}
    where c.id in (${sql.join(current.rows.map((r) => sql`${r.id}`), sql`, `)}) group by c.id
  `);
  const priorMap = new Map(priorResult.rows.map((r) => [r.id, Number(r.gross)]));
  let count = 0;
  for (const r of current.rows) {
    if (pctChange(Number(r.gross), priorMap.get(r.id) ?? 0) >= 50) count++;
  }
  return count;
}

async function getLatestOrdersWithItems() {
  const orders = await db.execute<{
    order_id: string; order_number: string | null; external_order_id: string | null;
    customer_name: string | null; customer_email: string | null; gross: string;
  }>(sql`
    select o.id as order_id, o.order_number, o.external_order_id, cu.name as customer_name, cu.email as customer_email, o.gross::text as gross
    from orders o left join customers cu on o.customer_id = cu.id order by o.ordered_at desc limit 4
  `);
  const ids = orders.rows.map((o) => o.order_id);
  if (ids.length === 0) return [];
  const items = await db.execute<{ order_id: string; name: string; quantity: number; gross: string }>(sql`
    select oi.order_id, coalesce(p.internal_name, oi.description_raw, 'Unknown item') as name, oi.quantity, oi.gross::text as gross
    from order_items oi left join products p on oi.product_id = p.id
    where oi.order_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `);
  const itemsByOrder = new Map<string, { name: string; quantity: number; gross: string }[]>();
  for (const it of items.rows) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ name: it.name, quantity: it.quantity, gross: formatMoney(it.gross) });
    itemsByOrder.set(it.order_id, arr);
  }
  return orders.rows.map((o) => ({ ...o, items: itemsByOrder.get(o.order_id) ?? [] }));
}

async function getTopProductsByChannel(startDate: string, endDate: string, channelKey: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select p.internal_name as name, coalesce(sum(oi.gross), 0)::text as gross
    from order_items oi join orders o on oi.order_id = o.id and o.ordered_at::date between ${startDate} and ${endDate}
    join channels c on o.channel_id = c.id and c.key = ${channelKey}
    join products p on oi.product_id = p.id group by p.id, p.internal_name order by sum(oi.gross) desc limit 3
  `);
  return result.rows;
}

async function getSalesByPlatform(startDate: string, endDate: string, range: string) {
  const result = await db.execute<{ name: string; gross: string }>(sql`
    select c.name, coalesce(sum(o.gross), 0)::text as gross from channels c
    left join orders o on o.channel_id = c.id and o.ordered_at::date between ${startDate} and ${endDate}
    group by c.name order by sum(o.gross) desc nulls last
  `);
  if (range === "all") return result.rows.map((r) => ({ ...r, grew: null as boolean | null }));
  const prior = priorPeriod(startDate, endDate);
  const priorResult = await db.execute<{ name: string; gross: string }>(sql`
    select c.name, coalesce(sum(o.gross), 0)::text as gross from channels c
    left join orders o on o.channel_id = c.id and o.ordered_at::date between ${prior.startDate} and ${prior.endDate}
    group by c.name
  `);
  const priorMap = new Map(priorResult.rows.map((r) => [r.name, Number(r.gross)]));
  return result.rows.map((r) => ({ ...r, grew: Number(r.gross) > (priorMap.get(r.name) ?? 0) }));
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
    join products p on oi.product_id = p.id group by p.id, p.internal_name order by sum(oi.gross) desc limit 1
  `);
  return result.rows[0] ?? null;
}
async function getAvailableMonths() {
  const result = await db.execute<{ ym: string }>(sql`
    select distinct to_char(date_trunc('month', ordered_at), 'YYYY-MM') as ym from orders order by ym desc
  `);
  return result.rows.map((r) => ({
    ym: r.ym,
    label: new Date(r.ym + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  }));
}
async function getFailedSyncCount() {
  const result = await db.execute<{ count: number }>(sql`
    select count(distinct connector)::int as count from sync_runs
    where status = 'failed' and started_at = (select max(started_at) from sync_runs sr2 where sr2.connector = sync_runs.connector)
  `);
  return result.rows[0]?.count ?? 0;
}

const SOURCE_COLORS: Record<string, string> = { Direct: "#AFD44F", Pinterest: "#467262", Instagram: "#E0A14D", Google: "#3B6D11", Facebook: "#A69F4F", Other: "#8A867B" };
const CARD_BG = "#EDEDE4";
const UPDATE_BG = "#E6E7B7";

// Donut geometry — single source of truth so the ring, hole, and slice labels
// all stay in sync when resized instead of drifting apart.
const DONUT_SIZE = 156;
const DONUT_HOLE_INSET = 24;
const DONUT_LABEL_RADIUS = (DONUT_SIZE - DONUT_HOLE_INSET) / 2 + DONUT_HOLE_INSET / 2 - 6;
const DONUT_CENTER = DONUT_SIZE / 2;

function Icon({ children }: { children: ReactNode }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C2A26" strokeWidth={1.6}>{children}</svg>;
}
const HEART = <Icon><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
const COIN = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12h6M12 9v6" strokeLinecap="round" strokeLinejoin="round" /></Icon>;
const SMILEY = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" /><line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" /><line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" /></Icon>;
const TARGET = <Icon><circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="4.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="1" fill="#2C2A26" /></Icon>;
const SEARCH_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A867B" strokeWidth={1.8}><circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 20l-4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const BELL_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C2A26" strokeWidth={1.6}><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 20a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function TrendBadge({ pct }: { pct: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: UPDATE_BG, borderRadius: 999, padding: "3px 9px", fontSize: 11, color: "#3B6D11", whiteSpace: "nowrap" }}>
      ↗ {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
    </span>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; ym?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { range, startDate, endDate, label } = resolveRange(sp);
  const showYoy = range !== "all";

  const [
    totals, customerCount, conversion, insight, monthlyBars, topClients, rapidGrowthCount,
    latestOrders, wixTop, gumroadTop, byPlatform, bySource, favoriteProduct, availableMonths,
    failedSyncCount,
  ] = await Promise.all([
    getTotals(startDate, endDate),
    getCustomerCount(startDate, endDate),
    getConversion(startDate, endDate),
    getWeeklyInsight(),
    getCalendarYearBars(endDate),
    getTopClients(startDate, endDate, range),
    getRapidGrowthCount(startDate, endDate, range),
    getLatestOrdersWithItems(),
    getTopProductsByChannel(startDate, endDate, "wix"),
    getTopProductsByChannel(startDate, endDate, "gumroad"),
    getSalesByPlatform(startDate, endDate, range),
    getSalesBySource(startDate, endDate),
    getFavoriteProduct(startDate, endDate),
    getAvailableMonths(),
    getFailedSyncCount(),
  ]);

  let yoy: { net: number; customers: number; conversion: number | null } | null = null;
  if (showYoy) {
    const yp = yoyPeriod(startDate, endDate);
    const [yoyTotals, yoyCustomers, yoyConversion] = await Promise.all([
      getTotals(yp.startDate, yp.endDate),
      getCustomerCount(yp.startDate, yp.endDate),
      getConversion(yp.startDate, yp.endDate),
    ]);
    yoy = {
      net: pctChange(Number(totals.net), Number(yoyTotals.net)),
      customers: pctChange(customerCount, yoyCustomers),
      conversion: conversion.reliable && yoyConversion.reliable ? pctChange(conversion.rate!, yoyConversion.rate!) : null,
    };
  }

  let salesReportGrowth: number | null = null;
  if (range !== "all") {
    const prior = priorPeriod(startDate, endDate);
    const priorTotals = await getTotals(prior.startDate, prior.endDate);
    salesReportGrowth = pctChange(Number(totals.gross), Number(priorTotals.gross));
  }

  const maxBarGross = Math.max(...monthlyBars.map((m) => m.gross), 1);
  const tierColor = { good: "#A69F4F", normal: "#D1D2BD", bad: "#DE9E4D" };
  const yAxisSteps = [1, 0.8, 0.6, 0.4, 0.2, 0];

  // Position small-slice percentage labels around the donut ring.
  let cumAngle = 0;
  const sliceLabels = bySource.rows.map((r) => {
    const pct = bySource.total > 0 ? (r.sessions / bySource.total) * 100 : 0;
    const midAngle = cumAngle + pct / 2;
    cumAngle += pct;
    const rad = (midAngle / 100) * 2 * Math.PI - Math.PI / 2;
    return { source: r.source, pct, x: DONUT_CENTER + DONUT_LABEL_RADIUS * Math.cos(rad), y: DONUT_CENTER + DONUT_LABEL_RADIUS * Math.sin(rad), isMajor: pct > 40 };
  });

  return (
    <div className="dash-outer" style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F2F3EE" }}>
      <Sidebar />

      <div className="dash-wrapper" style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header row — was previously missing entirely from this page */}
        <div className="dash-header-row" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 16, padding: "24px 32px 0" }}>
          <form action="/search" method="GET" style={{ flex: 1, maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBFCF6", border: "1px solid #D8D8C7", borderRadius: 999, padding: "9px 16px" }}>
              {SEARCH_ICON}
              <input
                name="q"
                placeholder="Search"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#2C2A26" }}
              />
            </div>
          </form>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", flexShrink: 0 }}>
            {BELL_ICON}
            {failedSyncCount > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#C1653B", border: "2px solid #F2F3EE" }} />
            )}
          </div>
        </div>

        <div className="dash-content-row" style={{ flex: 1, minWidth: 0, padding: "16px 32px 24px", display: "flex", gap: 24, height: "100%", overflow: "hidden" }}>
          <div className="dash-main-col" style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", paddingRight: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "#2C2A26", margin: 0 }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: "#8A867B", marginTop: 4 }}>Showing {label} across all four channels.</p>
              </div>
              <DashboardControls currentRange={range} currentLabel={label} hasExplicitMonth={!!sp.ym} availableMonths={availableMonths} />
            </div>

            <div className="dash-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 16 }}>
              <div style={{ minWidth: 0, background: UPDATE_BG, borderRadius: 22, padding: 20, height: 150, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{HEART}<span style={{ fontSize: 12, color: "#2C2A26" }}>Update</span></div>
                <div style={{ fontSize: 12, color: "#6B6B55" }}>{insight.date}</div>
                <div style={{ fontSize: 11, color: "#2C2A26", marginTop: 4, flex: 1 }}>
                  Sales revenue {insight.direction} <span style={{ color: "#3B6D11" }}>{Math.abs(insight.pctChange).toFixed(0)}%</span> in 1 week
                </div>
              </div>
              <div style={{ minWidth: 0, background: CARD_BG, borderRadius: 22, padding: 20, height: 150, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{COIN}<span style={{ fontSize: 12, color: "#2C2A26" }}>Net Income</span></div>
                <div style={{ fontSize: 26, color: "#2C2A26", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatMoney(totals.net)}</div>
                {yoy && <div style={{ fontSize: 11, color: yoy.net >= 0 ? "#3B6D11" : "#DE9E4D" }}>↗ {yoy.net >= 0 ? "+" : ""}{yoy.net.toFixed(0)}% from last year</div>}
              </div>
              <div style={{ minWidth: 0, background: CARD_BG, borderRadius: 22, padding: 20, height: 150, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{SMILEY}<span style={{ fontSize: 12, color: "#2C2A26" }}>Customers</span></div>
                <div style={{ fontSize: 26, color: "#2C2A26", marginTop: 8 }}>{customerCount.toLocaleString()}</div>
                {yoy && <div style={{ fontSize: 11, color: yoy.customers >= 0 ? "#3B6D11" : "#DE9E4D" }}>↗ {yoy.customers >= 0 ? "+" : ""}{yoy.customers.toFixed(0)}% from last year</div>}
              </div>
              <div style={{ minWidth: 0, background: CARD_BG, borderRadius: 22, padding: 20, height: 150, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>{TARGET}<span style={{ fontSize: 12, color: "#2C2A26" }}>Conversion</span></div>
                <div style={{ fontSize: 26, color: "#2C2A26", marginTop: 8 }}>{conversion.reliable ? `${conversion.rate!.toFixed(1)}%` : "—"}</div>
                {yoy && yoy.conversion != null ? (
                  <div style={{ fontSize: 11, color: yoy.conversion >= 0 ? "#3B6D11" : "#DE9E4D" }}>↗ {yoy.conversion >= 0 ? "+" : ""}{yoy.conversion.toFixed(0)}% from last year</div>
                ) : (
                  <div style={{ fontSize: 11, color: "#8A867B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversion.reliable ? `${conversion.orders} orders / ${conversion.sessions} sessions` : "GA4 data still syncing"}</div>
                )}
              </div>
            </div>

            <div className="dash-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 16 }}>
              <div style={{ minWidth: 0, gridColumn: "1 / span 3", background: CARD_BG, borderRadius: 22, padding: 22 }}>
                <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 4 }}>Sales Report</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, color: "#2C2A26" }}>{formatMoney(totals.gross)}</span>
                  {salesReportGrowth != null && <TrendBadge pct={salesReportGrowth} />}
                </div>
                <div style={{ display: "flex" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 200, paddingRight: 8, fontSize: 10, color: "#8A867B", flexShrink: 0 }}>
                    {yAxisSteps.map((s) => <span key={s}>{s === 0 ? "$0" : `$${Math.round((maxBarGross * s) / 100) * 100}`}</span>)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 8, height: 200, borderLeft: "1px solid #D8D8C7", paddingLeft: 12 }}>
                    {monthlyBars.map((m) => (
                      <div key={m.month} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ width: "60%", height: `${Math.max(4, (m.gross / maxBarGross) * 190)}px`, background: tierColor[m.tier], borderRadius: 8 }} title={formatMoney(m.gross)} />
                        <span style={{ fontSize: 10, color: "#8A867B" }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ minWidth: 0, gridColumn: "4 / span 1", background: CARD_BG, borderRadius: 22, padding: 20 }}>
                <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 14 }}>Top Clients</div>
                {topClients.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#8A867B" }}>No orders in this range.</p>
                ) : (
                  topClients.map((c) => (
                    <Link key={c.id} href={`/customers/${c.id}`} style={{ textDecoration: "none", display: "block" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #D8D8C7" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: UPDATE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#2C2A26", flexShrink: 0 }}>
                          {initials(c.name, c.email)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "#2C2A26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || c.email || "Unknown"}</div>
                          <div style={{ fontSize: 11, color: "#8A867B" }}>{c.order_count} orders</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 12, color: "#2C2A26" }}>{formatMoney(c.gross)}</div>
                          {c.growth != null && <div style={{ fontSize: 10, color: c.growth >= 0 ? "#3B6D11" : "#DE9E4D" }}>{c.growth >= 0 ? "+" : ""}{c.growth.toFixed(0)}%</div>}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
                {rapidGrowthCount != null && rapidGrowthCount > 0 && (
                  <div style={{ fontSize: 11, color: "#8A867B", marginTop: 10 }}>
                    <span style={{ color: "#3B6D11" }}>+{rapidGrowthCount} new</span> clients had a rapid increase in sales.
                  </div>
                )}
              </div>
            </div>

            <div className="dash-row-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div style={{ minWidth: 0, gridColumn: "1 / span 2", background: CARD_BG, borderRadius: 22, padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#2C2A26" }}>Latest Orders</span>
                  <TrendBadge pct={insight.orderCountChange} />
                </div>
                {latestOrders.map((o) => (
                  <ExpandableOrderRow
                    key={o.order_id}
                    label={o.order_number ? `#${o.order_number}` : (o.external_order_id ?? "—").slice(0, 8)}
                    customerLabel={o.customer_name || o.customer_email || "Unknown"}
                    itemCount={o.items.length}
                    gross={formatMoney(o.gross)}
                    items={o.items}
                  />
                ))}
              </div>
              <div style={{ minWidth: 0, gridColumn: "3 / span 2", background: CARD_BG, borderRadius: 22, padding: 22 }}>
                <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 14 }}>Top Products</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#2C2A26", marginBottom: 8 }}>Wix Studio</div>
                    {wixTop.map((p, i) => <div key={i} style={{ fontSize: 11, color: "#8A867B", padding: "4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} · {formatMoney(p.gross)}</div>)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#2C2A26", marginBottom: 8 }}>Gumroad</div>
                    {gumroadTop.map((p, i) => <div key={i} style={{ fontSize: 11, color: "#8A867B", padding: "4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} · {formatMoney(p.gross)}</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dash-right-rail" style={{ width: 235, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
            <div>
              <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 14 }}>Sales by Source</div>
              {bySource.total === 0 ? (
                <p style={{ fontSize: 12, color: "#8A867B" }}>No traffic source data synced yet.</p>
              ) : (
                <>
                  <div style={{ position: "relative", width: DONUT_SIZE, height: DONUT_SIZE, margin: "0 auto 10px" }}>
                    <div
                      style={{
                        width: DONUT_SIZE, height: DONUT_SIZE, borderRadius: "50%",
                        background: `conic-gradient(${bySource.rows.reduce((acc, r) => {
                          const pct = (r.sessions / bySource.total) * 100;
                          const start = acc.cum; acc.cum += pct;
                          acc.parts.push(`${SOURCE_COLORS[r.source] ?? "#8A867B"} ${start}% ${acc.cum}%`);
                          return acc;
                        }, { cum: 0, parts: [] as string[] }).parts.join(", ")})`,
                      }}
                    />
                    <div style={{ position: "absolute", inset: DONUT_HOLE_INSET, borderRadius: "50%", background: "#F2F3EE", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, color: "#8A867B" }}>Sessions</span>
                      <span style={{ fontSize: 16, color: "#2C2A26" }}>{bySource.total.toLocaleString()}</span>
                    </div>
                    {sliceLabels.filter((s) => !s.isMajor).map((s) => (
                      <div key={s.source} style={{ position: "absolute", left: s.x - 15, top: s.y - 9, width: 30, height: 18, borderRadius: 9, background: "#FBFCF6", fontSize: 10, color: "#2C2A26", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
                        {s.pct.toFixed(0)}%
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
                    {bySource.rows.map((r) => (
                      <div key={r.source} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: SOURCE_COLORS[r.source] ?? "#8A867B", flexShrink: 0 }} />
                        <span style={{ color: "#2C2A26" }}>{r.source}</span>
                        <span style={{ color: "#8A867B" }}>{((r.sessions / bySource.total) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 10 }}>Sales by Platform</div>
              {byPlatform.map((p) => (
                <div key={p.name} style={{ background: CARD_BG, borderRadius: 10, padding: "6px 12px", display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "#2C2A26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {p.grew && <span style={{ color: "#3B6D11", fontSize: 10 }}>↗</span>}
                    <span style={{ color: "#2C2A26" }}>{formatMoney(p.gross)}</span>
                  </span>
                </div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#2C2A26", marginBottom: 10 }}>Favorite Product</div>
              {favoriteProduct ? (
                <Link href={`/products/${favoriteProduct.product_id}`} style={{ textDecoration: "none" }}>
                  {favoriteProduct.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={favoriteProduct.cover_url} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 9, marginBottom: 10 }} />
                  ) : (
                    <div style={{ width: "100%", height: 90, borderRadius: 9, marginBottom: 10, background: "linear-gradient(135deg, #C1653B, #A8522E)" }} />
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

      <style>{`
        @media (max-width: 1300px) {
          .dash-outer { height: auto !important; overflow: visible !important; }
          .dash-wrapper { height: auto !important; overflow: visible !important; }
          .dash-content-row { flex-direction: column !important; height: auto !important; overflow: visible !important; }
          .dash-main-col { height: auto !important; overflow: visible !important; }
          .dash-right-rail { width: 100% !important; height: auto !important; overflow: visible !important; }
        }
        @media (max-width: 700px) {
          .dash-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dash-row-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .dash-row-grid > div { grid-column: auto !important; }
        }
        @media (max-width: 420px) {
          .dash-stat-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
