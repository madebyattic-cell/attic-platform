import { db } from "@/db/client";
import { customers, orders, orderItems, channels, products } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const countryDisplay = new Intl.DisplayNames(["en"], { type: "region" });

function fullCountryName(raw: string | null): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  if (trimmed.length === 2) {
    try {
      const name = countryDisplay.of(trimmed.toUpperCase());
      if (name) return name;
    } catch {
      // fall through
    }
  }
  return trimmed;
}

function formatMoney(value: string | number) {
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

async function getOrdersForCustomer(customerId: string) {
  return db
    .select({
      orderId: orders.id,
      orderedAt: orders.orderedAt,
      channelName: channels.name,
      gross: orders.gross,
      net: orders.net,
      itemId: orderItems.id,
      productId: orderItems.productId,
      productName: products.internalName,
      descriptionRaw: orderItems.descriptionRaw,
      itemGross: orderItems.gross,
    })
    .from(orders)
    .innerJoin(channels, eq(orders.channelId, channels.id))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.orderedAt));
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer) notFound();

  const orderRows = await getOrdersForCustomer(id);

  const uniqueOrders = new Map<string, { orderedAt: Date; channelName: string; gross: string; net: string }>();
  for (const r of orderRows) {
    if (!uniqueOrders.has(r.orderId)) {
      uniqueOrders.set(r.orderId, {
        orderedAt: r.orderedAt,
        channelName: r.channelName,
        gross: r.gross,
        net: r.net,
      });
    }
  }
  const lifetimeNet = Array.from(uniqueOrders.values()).reduce((sum, o) => sum + Number(o.net), 0);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, maxWidth: 900, padding: "0 0 40px" }}>
        <div style={{ padding: "16px 24px", borderBottom: "0.5px solid var(--border)" }}>
          <Link href="/customers" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ← Back to customers
          </Link>
          <div style={{ fontSize: 18, marginTop: 8, color: "var(--text-primary)" }}>
            {customer.name || customer.email || "Unknown customer"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {customer.email ?? "No email"} · {fullCountryName(customer.country)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: "24px", background: "var(--border)" }}>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total orders</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{uniqueOrders.size}</div>
          </div>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Lifetime value</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{formatMoney(lifetimeNet)}</div>
          </div>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Customer since</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{formatDate(customer.firstOrderAt)}</div>
          </div>
        </div>

        <div style={{ padding: "0 24px" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", margin: "8px 0 8px" }}>
            Order history
          </div>
          {orderRows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders recorded.</p>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr 0.8fr 0.7fr",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  padding: "6px 0",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <div>Date</div>
                <div>Product</div>
                <div>Channel</div>
                <div>Gross</div>
              </div>
              {orderRows.map((r) => {
                const productLabel = r.productName ?? r.descriptionRaw ?? "Unknown item";
                const row = (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 2fr 0.8fr 0.7fr",
                      fontSize: 13,
                      padding: "6px 0",
                      borderBottom: "0.5px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div>{formatDate(r.orderedAt)}</div>
                    <div style={{ color: r.productId ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {productLabel}
                    </div>
                    <div>{r.channelName}</div>
                    <div>${Number(r.itemGross ?? 0).toFixed(2)}</div>
                  </div>
                );
                return r.productId ? (
                  <Link
                    key={r.itemId ?? r.orderId}
                    href={`/products/${r.productId}`}
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={r.itemId ?? r.orderId}>{row}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
