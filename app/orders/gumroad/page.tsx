import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

type Row = {
  order_id: string;
  external_order_id: string | null;
  ordered_at: string;
  customer_name: string | null;
  customer_email: string | null;
  item_count: number;
  gross: string;
  net: string;
  buyer_country: string | null;
};

async function getOrders(page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  const countResult = await db.execute<{ total: number }>(sql`
    select count(*)::int as total from orders o
    join channels c on o.channel_id = c.id where c.key = 'gumroad'
  `);
  const total = countResult.rows[0]?.total ?? 0;

  const result = await db.execute<Row>(sql`
    select
      o.id as order_id,
      o.external_order_id,
      o.ordered_at::text as ordered_at,
      cu.name as customer_name,
      cu.email as customer_email,
      (select count(*)::int from order_items oi where oi.order_id = o.id) as item_count,
      o.gross::text as gross,
      o.net::text as net,
      o.buyer_country
    from orders o
    join channels c on o.channel_id = c.id and c.key = 'gumroad'
    left join customers cu on o.customer_id = cu.id
    order by o.ordered_at desc
    limit ${PAGE_SIZE} offset ${offset}
  `);

  return { rows: result.rows, total };
}

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function GumroadOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await getOrders(page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
            Gumroad Orders
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{total.toLocaleString()} total sales</p>
        </div>

        <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.3fr 1.4fr 0.6fr 0.9fr 0.9fr 0.8fr", padding: "10px 16px", fontSize: 11, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border)" }}>
            <div>Date</div>
            <div>Sale ID</div>
            <div>Customer</div>
            <div>Items</div>
            <div>Gross</div>
            <div>Net</div>
            <div>Country</div>
          </div>
          {rows.map((r, i) => (
            <div key={r.order_id} style={{ display: "grid", gridTemplateColumns: "0.9fr 1.3fr 1.4fr 0.6fr 0.9fr 0.9fr 0.8fr", alignItems: "center", padding: "10px 16px", borderBottom: i < rows.length - 1 ? "0.5px solid var(--border)" : "none", fontSize: 13 }}>
              <div style={{ color: "var(--text-secondary)" }}>{new Date(r.ordered_at).toLocaleDateString()}</div>
              <div style={{ color: "var(--text-primary)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.external_order_id ?? undefined}>{r.external_order_id ?? "—"}</div>
              <div style={{ color: "var(--text-secondary)" }}>{r.customer_name || r.customer_email || "Unknown"}</div>
              <div style={{ color: "var(--text-secondary)" }}>{r.item_count}</div>
              <div style={{ color: "var(--text-primary)" }}>{formatMoney(r.gross)}</div>
              <div style={{ color: "var(--text-secondary)" }}>{formatMoney(r.net)}</div>
              <div style={{ color: "var(--text-secondary)" }}>{r.buyer_country ?? "—"}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 && <Link href={`/orders/gumroad?page=${page - 1}`} style={{ fontSize: 13 }}>← Previous</Link>}
            {page < totalPages && <Link href={`/orders/gumroad?page=${page + 1}`} style={{ fontSize: 13 }}>Next →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
