import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function searchProducts(q: string) {
  const result = await db.execute<{ id: string; name: string }>(sql`
    select id, internal_name as name from products where internal_name ilike ${"%" + q + "%"} limit 8
  `);
  return result.rows;
}
async function searchCustomers(q: string) {
  const result = await db.execute<{ id: string; name: string | null; email: string | null }>(sql`
    select id, name, email from customers where name ilike ${"%" + q + "%"} or email ilike ${"%" + q + "%"} limit 8
  `);
  return result.rows;
}
async function searchOrders(q: string) {
  const result = await db.execute<{ id: string; order_number: string | null; external_order_id: string | null }>(sql`
    select id, order_number, external_order_id from orders
    where order_number ilike ${"%" + q + "%"} or external_order_id ilike ${"%" + q + "%"} limit 8
  `);
  return result.rows;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const [products, customers, orders] = q
    ? await Promise.all([searchProducts(q), searchCustomers(q), searchOrders(q)])
    : [[], [], []];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F2F3EE" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px", maxWidth: 700 }}>
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "#2C2A26", margin: 0 }}>
          Search results for &ldquo;{q}&rdquo;
        </h1>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#8A867B", marginBottom: 8 }}>Products ({products.length})</div>
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} style={{ display: "block", padding: "8px 0", fontSize: 14, color: "#2C2A26", textDecoration: "none", borderBottom: "1px solid #D8D8C7" }}>
              {p.name}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#8A867B", marginBottom: 8 }}>Customers ({customers.length})</div>
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} style={{ display: "block", padding: "8px 0", fontSize: 14, color: "#2C2A26", textDecoration: "none", borderBottom: "1px solid #D8D8C7" }}>
              {c.name || c.email}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#8A867B", marginBottom: 8 }}>Orders ({orders.length})</div>
          {orders.map((o) => (
            <div key={o.id} style={{ padding: "8px 0", fontSize: 14, color: "#2C2A26", borderBottom: "1px solid #D8D8C7" }}>
              {o.order_number ? `#${o.order_number}` : o.external_order_id}
            </div>
          ))}
        </div>

        {q && products.length === 0 && customers.length === 0 && orders.length === 0 && (
          <p style={{ fontSize: 13, color: "#8A867B", marginTop: 24 }}>No results found.</p>
        )}
      </div>
    </div>
  );
}
