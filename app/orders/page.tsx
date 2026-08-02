import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ORDERS_TABS } from "@/components/nav-tabs";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getChannelStats() {
  const result = await db.execute<{ key: string; name: string; order_count: number; gross: string }>(sql`
    select c.key, c.name, count(o.id)::int as order_count, coalesce(sum(o.gross), 0)::text as gross
    from channels c
    left join orders o on o.channel_id = c.id
    group by c.key, c.name
  `);
  return result.rows;
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const CHANNEL_HREFS: Record<string, string> = {
  wix: "/orders/wix",
  gumroad: "/orders/gumroad",
  creative_market: "/orders/creative-market",
  behance: "/orders/behance",
};

export default async function OrdersHubPage() {
  const stats = await getChannelStats();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ORDERS_TABS} active="" />
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Orders
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
          {stats
            .filter((s) => CHANNEL_HREFS[s.key])
            .map((s) => (
              <Link key={s.key} href={CHANNEL_HREFS[s.key]} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "16px", border: "0.5px solid var(--border)" }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{s.name}</div>
                  <div style={{ fontSize: 20, color: "var(--text-primary)", marginTop: 6 }}>{s.order_count.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>orders</div>
                  <div style={{ fontSize: 13, color: "var(--text-accent)", marginTop: 4 }}>{formatMoney(s.gross)}</div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
