import { db } from "@/db/client";
import { products, series, listings, channels, orderItems, orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getListingsForProduct(productId: string) {
  return db
    .select({
      id: listings.id,
      channelName: channels.name,
      price: listings.price,
      status: listings.status,
      url: listings.url,
      externalId: listings.externalId,
    })
    .from(listings)
    .innerJoin(channels, eq(listings.channelId, channels.id))
    .where(eq(listings.productId, productId));
}

async function getOrdersForProduct(productId: string) {
  return db
    .select({
      itemId: orderItems.id,
      gross: orderItems.gross,
      quantity: orderItems.quantity,
      orderedAt: orders.orderedAt,
      externalOrderId: orders.externalOrderId,
      channelId: orders.channelId,
      channelName: channels.name,
      buyerCountry: orders.buyerCountry,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(channels, eq(orders.channelId, channels.id))
    .where(eq(orderItems.productId, productId))
    .orderBy(desc(orders.orderedAt));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) notFound();

  const productSeries = product.seriesId
    ? await db.query.series.findFirst({ where: eq(series.id, product.seriesId) })
    : null;

  const [listingRows, orderRows] = await Promise.all([
    getListingsForProduct(product.id),
    getOrdersForProduct(product.id),
  ]);

  const totalRevenue = orderRows.reduce((sum, o) => sum + Number(o.gross || 0), 0);
  const totalOrders = orderRows.length;

  const revenueByChannel = new Map<string, { count: number; gross: number }>();
  for (const o of orderRows) {
    const existing = revenueByChannel.get(o.channelName) ?? { count: 0, gross: 0 };
    existing.count += 1;
    existing.gross += Number(o.gross || 0);
    revenueByChannel.set(o.channelName, existing);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, maxWidth: 960 }}>
        <div style={{ padding: "16px 24px", borderBottom: "0.5px solid var(--border)" }}>
          <a href="/listings" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ← Back to listings
          </a>
          <div style={{ fontSize: 18, marginTop: 8, color: "var(--text-primary)" }}>
            {product.internalName}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {productSeries?.name ?? "No series"} · {product.kind}
            {product.number != null ? ` · #${product.number}` : ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: "24px", background: "var(--border)" }}>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total orders</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{totalOrders}</div>
          </div>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total revenue</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>${totalRevenue.toFixed(2)}</div>
          </div>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Live listings</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{listingRows.length}</div>
          </div>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", margin: "16px 0 8px" }}>
            Channel listings
          </div>
          {listingRows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No channel listings yet.</p>
          ) : (
            listingRows.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "0.5px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span>{l.channelName}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {l.price ? `$${l.price}` : "—"} · {l.status}
                </span>
              </div>
            ))
          )}

          <div style={{ fontSize: 13, color: "var(--text-primary)", margin: "24px 0 8px" }}>
            Revenue by channel
          </div>
          {revenueByChannel.size === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders yet.</p>
          ) : (
            Array.from(revenueByChannel.entries()).map(([channelName, stats]) => (
              <div
                key={channelName}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "0.5px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span>{channelName}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {stats.count} orders · ${stats.gross.toFixed(2)}
                </span>
              </div>
            ))
          )}

          <div style={{ fontSize: 13, color: "var(--text-primary)", margin: "24px 0 8px" }}>
            Order history ({totalOrders})
          </div>
          {orderRows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders recorded for this product.</p>
          ) : (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr 0.6fr 1fr",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  padding: "6px 0",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <div>Date</div>
                <div>Order #</div>
                <div>Channel</div>
                <div>Qty</div>
                <div>Gross</div>
                <div>Country</div>
              </div>
              {orderRows.map((o) => (
                <div
                  key={o.itemId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr 0.6fr 1fr",
                    fontSize: 13,
                    padding: "6px 0",
                    borderBottom: "0.5px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div>{new Date(o.orderedAt).toLocaleDateString()}</div>
                  <div style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.externalOrderId ?? undefined}>
                    {o.externalOrderId ?? "—"}
                  </div>
                  <div>{o.channelName}</div>
                  <div>{o.quantity}</div>
                  <div>${Number(o.gross).toFixed(2)}</div>
                  <div>{o.buyerCountry ?? "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
