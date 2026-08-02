import { db } from "@/db/client";
import { channels } from "@/db/schema";
import { Sidebar } from "@/components/sidebar";
import { createProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const allChannels = await db.select().from(channels);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Add a product
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 28 }}>
          Creates the product and a listing for each channel you set a price on.
        </p>

        <form action={createProduct} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Series
            </label>
            <input name="seriesName" placeholder="e.g. Eclat du Menu" style={{ width: "100%" }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Internal name
            </label>
            <input
              name="internalName"
              required
              placeholder="e.g. eclat 04 : menu mockup on marble"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Object
              </label>
              <input name="objectNoun" required placeholder="e.g. menu" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Scene
              </label>
              <input name="sceneName" placeholder="e.g. on marble" style={{ width: "100%" }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Complexity band
            </label>
            <select name="complexityBand" style={{ width: "100%" }} defaultValue="standard">
              <option value="standard">Standard ($12 Wix)</option>
              <option value="complex">Complex ($14 Wix)</option>
              <option value="heavy">Heavy multi-object ($16 Wix)</option>
            </select>
          </div>

          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 18, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              Channel prices — leave blank to skip that channel
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allChannels.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", width: 130, flexShrink: 0 }}>
                    {c.name}
                  </span>
                  <input
                    name={`price_${c.key}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    style={{ width: 120 }}
                  />
                </div>
              ))}
            </div>
tail -5 app/products/new/page.tsx
cat > app/listings/page.tsx << 'ENDOFFILE'
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
