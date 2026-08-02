"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "retired", label: "Discontinue" },
  { value: "archived", label: "Archive" },
];

export function StatusActions({ productId, currentStatus }: { productId: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: string) {
    if (status === currentStatus) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={loading || o.value === currentStatus}
          onClick={() => setStatus(o.value)}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "0.5px solid var(--border)",
            background: o.value === currentStatus ? "var(--surface-1)" : "transparent",
            color: o.value === currentStatus ? "var(--text-muted)" : "var(--text-primary)",
            cursor: o.value === currentStatus ? "default" : "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
      {error && <span style={{ fontSize: 11, color: "#C62828" }}>{error}</span>}
    </div>
  );
}
