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
            <select name="complexityBand" id="complexityBand" style={{ width: "100%" }} defaultValue="standard">
              <option value="standard">Standard</option>
              <option value="complex">Complex</option>
              <option value="heavy">Heavy multi-object</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Cover image
            </label>
            <input name="coverImage" type="file" accept="image/*" />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Crop to 2:3 before uploading — this is what shows in the listings table.
            </div>
          </div>

          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 18, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              Channel prices — leave blank to skip that channel. Set the Wix price
              first and the others fill in automatically; edit any of them by hand
              to stop the auto-fill for that one.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allChannels
                .filter((c) => c.key !== "creative_market")
                .map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", width: 130, flexShrink: 0 }}>
                      {c.name}
                    </span>
                    <input
                      id={`price_${c.key}`}
                      name={`price_${c.key}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      style={{ width: 120 }}
                      data-user-edited="false"
                    />
                  </div>
                ))}

              {allChannels.some((c) => c.key === "creative_market") && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", width: 130, flexShrink: 0, paddingTop: 8 }}>
                    Creative Market
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        id="price_creative_market_personal"
                        name="price_creative_market_personal"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        style={{ width: 120 }}
                        data-user-edited="false"
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Personal</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        id="price_creative_market_commercial"
                        name="price_creative_market_commercial"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        style={{ width: 120 }}
                        data-user-edited="false"
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Commercial</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        id="price_creative_market_extended"
                        name="price_creative_market_extended"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        style={{ width: 120 }}
                        data-user-edited="false"
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Extended</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="submit">Create product</button>
            <a href="/listings" style={{ display: "flex", alignItems: "center" }}>
              <button type="button">Cancel</button>
            </a>
          </div>
        </form>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var wixInput = document.getElementById('price_wix');
                var bandSelect = document.getElementById('complexityBand');
                if (!wixInput) return;

                var otherIds = [
                  'price_gumroad',
                  'price_behance',
                  'price_creative_market_personal',
                  'price_creative_market_commercial',
                  'price_creative_market_extended',
                ];
                var others = otherIds
                  .map(function (id) { return document.getElementById(id); })
                  .filter(Boolean);

                others.forEach(function (el) {
                  el.addEventListener('input', function () {
                    el.setAttribute('data-user-edited', 'true');
                  });
                });
                wixInput.addEventListener('input', function () {
                  wixInput.setAttribute('data-user-edited', 'true');
                });

                // Offsets from the standard band: Wix $12 / Gumroad $14 /
                // Behance $19 / Creative Market $15 personal, $24 commercial,
                // $60 extended. Applied as a flat offset from whatever Wix
                // price is set — an approximation at higher bands, since the
                // exact ladder above $12 hasn't been pinned down yet.
                var offsets = {
                  price_gumroad: 2,
                  price_behance: 7,
                  price_creative_market_personal: 3,
                  price_creative_market_commercial: 12,
                  price_creative_market_extended: 48,
                };

                function cascadeFromWix() {
                  var wixPrice = parseFloat(wixInput.value);
                  if (isNaN(wixPrice)) return;

                  others.forEach(function (el) {
                    if (el.getAttribute('data-user-edited') === 'true') return;
                    var offset = offsets[el.id] || 0;
                    el.value = (wixPrice + offset).toFixed(2);
                  });
                }

                wixInput.addEventListener('input', cascadeFromWix);

                // Complexity band sets a default Wix price, which then
                // cascades to everything else — so there's one source of
                // truth instead of the band and the price disagreeing.
                var bandDefaults = { standard: 12, complex: 14, heavy: 16 };
                if (bandSelect) {
                  bandSelect.addEventListener('change', function () {
                    if (wixInput.getAttribute('data-user-edited') === 'true') return;
                    var def = bandDefaults[bandSelect.value];
                    if (def == null) return;
                    wixInput.value = def.toFixed(2);
                    cascadeFromWix();
                  });
                }
              })();
            `,
          }}
        />
      </div>
    </div>
  );
}
