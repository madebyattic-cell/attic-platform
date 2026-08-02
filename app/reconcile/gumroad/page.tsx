"use client";

import { useEffect, useState } from "react";

type UnmatchedItem = {
  externalId: string;
  name: string;
  price: number;
  url?: string;
  published: boolean;
};

type ProductOption = {
  id: string;
  internalName: string;
  status: string;
};

export default function ReconcileGumroadPage() {
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gumroad/unmatched");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setUnmatched(data.unmatched);
      setProductOptions(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLink(item: UnmatchedItem) {
    const productId = selected[item.externalId];
    if (!productId) return;

    setLinking(item.externalId);
    setError(null);
    try {
      const res = await fetch("/api/gumroad/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: item.externalId,
          name: item.name,
          price: item.price,
          url: item.url,
          published: item.published,
          productId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Link failed");

      // Remove the linked item from the list rather than reloading everything.
      setUnmatched((prev) => prev.filter((u) => u.externalId !== item.externalId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinking(null);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        Reconcile Gumroad listings
      </h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        Gumroad products that could not be automatically matched to a Made by Attic product.
        Pick the correct product for each and link it.
      </p>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #fbb", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : unmatched.length === 0 ? (
        <p style={{ color: "#666" }}>Nothing left to reconcile — every Gumroad product is linked.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "8px 4px" }}>Gumroad product</th>
              <th style={{ padding: "8px 4px" }}>Price</th>
              <th style={{ padding: "8px 4px" }}>Match to</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {unmatched.map((item) => (
              <tr key={item.externalId} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px" }}>{item.name}</td>
                <td style={{ padding: "8px 4px" }}>${item.price.toFixed(2)}</td>
                <td style={{ padding: "8px 4px" }}>
                  <select
                    value={selected[item.externalId] ?? ""}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [item.externalId]: e.target.value }))
                    }
                    style={{ padding: 4, minWidth: 260 }}
                  >
                    <option value="">Select a product…</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.internalName} ({p.status})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <button
                    onClick={() => handleLink(item)}
                    disabled={!selected[item.externalId] || linking === item.externalId}
                    style={{
                      padding: "4px 12px",
                      background: "#111",
                      color: "#fff",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      opacity: !selected[item.externalId] ? 0.4 : 1,
                    }}
                  >
                    {linking === item.externalId ? "Linking…" : "Link"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
