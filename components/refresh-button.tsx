"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/refresh-all", { method: "POST" });
      const data = await res.json();
      const okCount = Object.values(data.results ?? {}).filter((r: any) => r.ok).length;
      const total = Object.keys(data.results ?? {}).length;
      setResult(`${okCount}/${total} synced`);
      router.refresh();
    } catch {
      setResult("Failed");
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 4000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        width: "100%",
        padding: "7px 10px",
        borderRadius: 8,
        border: "0.5px solid var(--border)",
        background: "var(--surface-2)",
        color: "var(--text-primary)",
        fontSize: 12,
        cursor: loading ? "default" : "pointer",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}
      >
        <path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loading ? "Refreshing…" : result ?? "Refresh data"}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
