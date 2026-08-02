"use client";

import { useEffect, useMemo, useState } from "react";

type UnmatchedRow = {
  description: string;
  count: number;
  totalGross: string;
};

type ProductOption = {
  id: string;
  internalName: string;
  status: string;
  seriesName: string | null;
  number: number | null;
};

export default function ReconcileOrdersPage() {
  const [rows, setRows] = useState<UnmatchedRow[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [filterText, setFilterText] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, productsRes] = await Promise.all([
        fetch("/api/backfill/unmatched-summary", {
          headers: { Authorization: "Bearer atticbyattic2026secure" },
        }),
        fetch("/api/products/list"),
      ]);
      const summaryData = await summaryRes.json();
      const productsData = await productsRes.json();
      if (!summaryRes.ok) throw new Error(summaryData.error ?? "Failed to load summary");
      if (!productsRes.ok) throw new Error(productsData.error ?? "Failed to load products");

      setRows(
        (summaryData.rows as UnmatchedRow[]).sort((a, b) => b.count - a.count)
      );
      setProductOptions(productsData.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMerge(row: UnmatchedRow) {
    const productId = selected[row.description];
    if (!productId) return;

    setMerging(row.description);
    setError(null);
    try {
      const res = await fetch("/api/backfill/manual-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: row.description, productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Merge failed");

      setRows((prev) => prev.filter((r) => r.description !== row.description));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(null);
    }
  }

  function filteredOptions(description: string): ProductOption[] {
    const q = (filterText[description] ?? "").toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter(
      (p) =>
        p.internalName.toLowerCase().includes(q) ||
        (p.seriesName ?? "").toLowerCase().includes(q)
    );
  }

  const totalOrdersAffected = useMemo(() => rows.reduce((sum, r) => sum + r.count, 0), [rows]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        Reconcile order attribution
      </h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
        {rows.length} distinct descriptions still unmatched, covering {totalOrdersAffected} order line
        items. Search for the real product and merge.
      </p>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #fbb", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#666" }}>Nothing left to reconcile.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "8px 4px" }}>Description</th>
              <th style={{ padding: "8px 4px" }}>Orders</th>
              <th style={{ padding: "8px 4px" }}>Gross</th>
              <th style={{ padding: "8px 4px" }}>Match to</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.description} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px", maxWidth: 260 }}>{row.description}</td>
                <td style={{ padding: "8px 4px" }}>{row.count}</td>
                <td style={{ padding: "8px 4px" }}>${row.totalGross}</td>
                <td style={{ padding: "8px 4px" }}>
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={filterText[row.description] ?? ""}
                    onChange={(e) =>
                      setFilterText((prev) => ({ ...prev, [row.description]: e.target.value }))
                    }
                    style={{ padding: 4, width: 160, marginBottom: 4, display: "block" }}
                  />
                  <select
                    value={selected[row.description] ?? ""}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [row.description]: e.target.value }))
                    }
                    style={{ padding: 4, width: 260 }}
                  >
                    <option value="">Select a product…</option>
                    {filteredOptions(row.description).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.seriesName ?? "—"} {p.number ?? ""} — {p.internalName} ({p.status})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  <button
                    onClick={() => handleMerge(row)}
                    disabled={!selected[row.description] || merging === row.description}
                    style={{
                      padding: "4px 12px",
                      background: "#111",
                      color: "#fff",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      opacity: !selected[row.description] ? 0.4 : 1,
                    }}
                  >
                    {merging === row.description ? "Merging…" : "Merge"}
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
