import { db } from "@/db/client";
import { channels, series, products } from "@/db/schema";
import { isNotNull, ne, and } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { createProduct } from "../actions";

export const dynamic = "force-dynamic";

async function getFormData() {
  const allChannels = await db.select().from(channels);
  const allSeries = await db.select({ name: series.name }).from(series);
  const objectRows = await db.selectDistinct({ value: products.objectNoun }).from(products);
  const categoryRows = await db
    .selectDistinct({ value: products.category })
    .from(products)
    .where(and(isNotNull(products.category), ne(products.category, "")));

  return {
    allChannels,
    seriesOptions: allSeries.map((s) => s.name),
    objectOptions: objectRows.map((r) => r.value).filter((v): v is string => !!v),
    categoryOptions: categoryRows.map((r) => r.value).filter((v): v is string => !!v),
  };
}

function ComboField({
  label,
  name,
  selectId,
  inputId,
  options,
  placeholder,
}: {
  label: string;
  name: string;
  selectId: string;
  inputId: string;
  options: string[];
  placeholder: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <select id={selectId} name={name} style={{ width: "100%" }} defaultValue="">
        <option value="" disabled>
          Select {label.toLowerCase()}...
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__new__">+ Create new...</option>
      </select>
      <input
        id={inputId}
        name={name}
        placeholder={placeholder}
        style={{ width: "100%", display: "none", marginTop: 6 }}
      />
      <button
        type="button"
        id={`${inputId}_back`}
        style={{ display: "none", marginTop: 6, fontSize: 11 }}
      >
        ← choose existing
      </button>
    </div>
  );
}

export default async function NewProductPage() {
  const { allChannels, seriesOptions, objectOptions, categoryOptions } = await getFormData();

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
          <ComboField
            label="Series"
            name="seriesName"
            selectId="seriesSelect"
            inputId="seriesInput"
            options={seriesOptions}
            placeholder="e.g. Eclat du Menu"
          />

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
            <ComboField
              label="Object"
              name="objectNoun"
              selectId="objectSelect"
              inputId="objectInput"
              options={objectOptions}
              placeholder="e.g. menu"
            />
            <ComboField
              label="Category"
              name="category"
              selectId="categorySelect"
              inputId="categoryInput"
              options={categoryOptions}
              placeholder="e.g. Menus"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Cover image
            </label>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input id="coverImageInput" name="coverImage" type="file" accept="image/*" />
              <img
                id="coverPreview"
                alt=""
                style={{
                  width: 60,
                  height: 90,
                  borderRadius: 6,
                  objectFit: "cover",
                  display: "none",
                  border: "0.5px solid var(--border)",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Crop to 2:3 before uploading — this is what shows in the listings table.
            </div>
          </div>

          <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 18, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              Channel prices — leave blank to skip that channel. Wix defaults to
              $12; the others fill in automatically from it. Edit any of them by
              hand to stop the auto-fill for that one.
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
                      defaultValue={c.key === "wix" ? "12.00" : undefined}
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
                // --- Combo fields: select existing or create new ---
                function initCombo(selectId, inputId) {
                  var select = document.getElementById(selectId);
                  var input = document.getElementById(inputId);
                  var backBtn = document.getElementById(inputId + '_back');
                  if (!select || !input || !backBtn) return;

                  select.addEventListener('change', function () {
                    if (select.value === '__new__') {
                      select.style.display = 'none';
                      select.removeAttribute('name');
                      input.style.display = 'block';
                      input.setAttribute('name', select.getAttribute('data-field-name') || '');
                      backBtn.style.display = 'inline-block';
                      input.focus();
                    }
                  });

                  backBtn.addEventListener('click', function () {
                    input.style.display = 'none';
                    input.removeAttribute('name');
                    input.value = '';
                    backBtn.style.display = 'none';
                    select.style.display = 'block';
                    select.setAttribute('name', select.getAttribute('data-field-name') || '');
                    select.value = '';
                  });
                }

                ['seriesSelect|seriesInput', 'objectSelect|objectInput', 'categorySelect|categoryInput'].forEach(function (pair) {
                  var parts = pair.split('|');
                  var select = document.getElementById(parts[0]);
                  if (select) select.setAttribute('data-field-name', select.getAttribute('name') || '');
                  initCombo(parts[0], parts[1]);
                });

                // --- Cover image preview ---
                var fileInput = document.getElementById('coverImageInput');
                var preview = document.getElementById('coverPreview');
                if (fileInput && preview) {
                  fileInput.addEventListener('change', function () {
                    var file = fileInput.files && fileInput.files[0];
                    if (!file) { preview.style.display = 'none'; return; }
                    var reader = new FileReader();
                    reader.onload = function (e) {
                      preview.src = e.target.result;
                      preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                  });
                }

                // --- Price cascade from Wix ---
                var wixInput = document.getElementById('price_wix');
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
                cascadeFromWix();
              })();
            `,
          }}
        />
      </div>
    </div>
  );
}
