import { db } from "@/db/client";
import { listings, products, series, channels, assets, orderItems } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getListings() {
  const rows = await db
    .select({
      id: listings.id,
      productId: products.id,
      displayTitle: listings.displayTitle,
      price: listings.price,
      status: listings.status,
      seriesName: series.name,
      seriesCode: series.code,
      channelName: channels.name,
      coverUrl: assets.url,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .leftJoin(series, eq(products.seriesId, series.id))
    .innerJoin(channels, eq(listings.channelId, channels.id))
    .leftJoin(assets, and(eq(assets.productId, products.id), eq(assets.kind, "cover")))
    .orderBy(series.name, products.number, channels.name);

  const revenueRows = await db
    .select({
      productId: orderItems.productId,
      orders: sql<number>`count(*)::int`,
      revenue: sql<string>`sum(${orderItems.gross})::text`,
    })
    .from(orderItems)
    .where(sql`${orderItems.productId} is not null`)
    .groupBy(orderItems.productId);

  const revenueByProduct = new Map(
    revenueRows.map((r) => [r.productId as string, { orders: r.orders, revenue: Number(r.revenue) }])
  );

  return rows.map((row) => ({
    ...row,
    orders: revenueByProduct.get(row.productId)?.orders ?? 0,
    revenue: revenueByProduct.get(row.productId)?.revenue ?? 0,
  }));
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    live: { bg: "var(--bg-success)", text: "var(--text-success)", label: "Live" },
    draft: { bg: "var(--surface-1)", text: "var(--text-muted)", label: "Draft" },
    unlisted: { bg: "var(--bg-warning)", text: "var(--text-warning)", label: "Unlisted" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 6,
      }}
    >
      {s.label}
    </span>
  );
}

const GRID_COLUMNS = "2fr 1fr 0.8fr 0.7fr 0.6fr 0.6fr 0.8fr";

export default async function ListingsPage() {
  const rows = await getListings();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 15, color: "var(--text-primary)" }}>
            Listings <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({rows.length})</span>
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <input placeholder="Search listings..." style={{ width: 200 }} />
            <a href="/products/new">
              <button type="button">Add product</button>
            </a>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              No listings yet. Run the Wix and Gumroad sync, or add one manually.
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                padding: "10px 24px",
                fontSize: 11,
                color: "var(--text-muted)",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              <div>Product</div>
              <div>Series</div>
              <div>Channel</div>
              <div>Status</div>
              <div>Price</div>
              <div>Orders</div>
              <div>Revenue</div>
            </div>
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/products/${row.productId}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID_COLUMNS,
                    alignItems: "center",
                    padding: "11px 24px",
                    borderBottom: "0.5px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {row.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.coverUrl}
                        alt=""
                        style={{
                          width: 32,
                          height: 48,
                          borderRadius: 6,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 48,
                          borderRadius: 6,
                          background: "linear-gradient(135deg, #C1653B, #A8522E)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {row.displayTitle ?? "Untitled listing"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {row.seriesName ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {row.channelName}
                  </div>
                  <div>
                    <StatusPill status={row.status} />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {row.price ? `$${row.price}` : "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {row.orders || "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {row.revenue ? `$${row.revenue.toFixed(2)}` : "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
