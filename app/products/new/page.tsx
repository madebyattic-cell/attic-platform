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
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="submit">Create product</button>
            <a href="/listings" style={{ display: "flex", alignItems: "center" }}>
              <button type="button">Cancel</button>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
