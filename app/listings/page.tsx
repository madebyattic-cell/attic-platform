import { db } from "@/db/client";
import { listings, products, series, channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

async function getListings() {
  return db
    .select({
      id: listings.id,
      displayTitle: listings.displayTitle,
      price: listings.price,
      status: listings.status,
      seriesName: series.name,
      seriesCode: series.code,
      channelName: channels.name,
    })
    .from(listings)
    .innerJoin(products, eq(listings.productId, products.id))
    .leftJoin(series, eq(products.seriesId, series.id))
    .innerJoin(channels, eq(listings.channelId, channels.id))
    .limit(50);
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
          <span style={{ fontSize: 15, color: "var(--text-primary)" }}>Listings</span>
          <input placeholder="Search listings..." style={{ width: 200 }} />
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
                gridTemplateColumns: "2.2fr 1.2fr 1fr 0.9fr 0.7fr",
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
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.2fr 1.2fr 1fr 0.9fr 0.7fr",
                  alignItems: "center",
                  padding: "11px 24px",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #C1653B, #A8522E)",
                      flexShrink: 0,
                    }}
                  />
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
