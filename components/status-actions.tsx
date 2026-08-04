"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

const OPTIONS: { value: string; label: string; destructive: boolean }[] = [
  { value: "draft", label: "Draft", destructive: false },
  { value: "live", label: "Live", destructive: false },
  { value: "retired", label: "Discontinue", destructive: true },
  { value: "archived", label: "Archive", destructive: true },
];

export function StatusActions({ productId, currentStatus }: { productId: string; currentStatus: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: string, destructive: boolean, label: string) {
    if (status === currentStatus) return;
    if (destructive && !confirm(`${label} this product? You can change its status back at any time.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");
      toast.show(`Status changed to ${label}`);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), "error");
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
          onClick={() => setStatus(o.value, o.destructive, o.label)}
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
    </div>
  );
}
