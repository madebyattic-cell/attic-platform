import { db } from "@/db/client";
import { products, series, listings, channels, orderItems, orders, metricsDaily } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { StatusActions } from "@/components/status-actions";
import { ManualViewsForm } from "@/components/manual-views-form";
import { BackLink } from "@/components/back-link";
import { formatMoney, formatDate } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getManualViews(productId: string) {
  return db
    .select({
      id: metricsDaily.id,
      day: metricsDaily.day,
      views: metricsDaily.views,
      channelName: channels.name,
    })
    .from(metricsDaily)
    .innerJoin(listings, eq(metricsDaily.listingId, listings.id))
    .innerJoin(channels, eq(listings.channelId, channels.id))
    .where(and(eq(listings.productId, productId), eq(metricsDaily.source, "manual")))
    .orderBy(desc(metricsDaily.day))
    .limit(20);
}

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
      orderNumber: orders.orderNumber,
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

  const [listingRows, orderRows, manualViews] = await Promise.all([
    getListingsForProduct(product.id),
    getOrdersForProduct(product.id),
    getManualViews(product.id),
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
          <BackLink fallbackHref="/listings" label="Back to listings" />
          <div style={{ fontSize: 18, marginTop: 8, color: "var(--text-primary)" }}>
            {product.internalName}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {productSeries?.name ?? "No series"} · {product.kind}
            {product.number != null ? ` · #${product.number}` : ""}
          </div>
          <div style={{ marginTop: 12 }}>
            <StatusActions productId={product.id} currentStatus={product.status} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: "24px", background: "var(--border)" }}>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total orders</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{totalOrders}</div>
          </div>
          <div style={{ background: "var(--surface-0)", padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total revenue</div>
            <div style={{ fontSize: 22, color: "var(--text-primary)" }}>{formatMoney(totalRevenue)}</div>
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
            Manual views
          </div>
          <div style={{ marginBottom: 10 }}>
            <ManualViewsForm productId={product.id} />
          </div>
          {manualViews.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {manualViews.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border)" }}>
                  <span>{v.channelName}</span>
                  <span>{new Date(v.day).toLocaleDateString()}</span>
                  <span>{v.views} views</span>
                </div>
              ))}
            </div>
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
                  {stats.count} orders · {formatMoney(stats.gross)}
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
                    {o.orderNumber ? `#${o.orderNumber}` : (o.externalOrderId ?? "—")}
                  </div>
                  <div>{o.channelName}</div>
                  <div>{o.quantity}</div>
                  <div>{formatMoney(o.gross)}</div>
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
