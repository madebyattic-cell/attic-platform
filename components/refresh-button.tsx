"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RefreshButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/sync-status");
      const data = await res.json();
      setLastSyncedAt(data.lastSyncedAt);
    } catch {
      // silent — freshness indicator is a nice-to-have, not critical
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleRefresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/refresh-all", { method: "POST" });
      const data = await res.json();
      const results = data.results ?? {};
      const okCount = Object.values(results).filter((r: any) => r.ok).length;
      const total = Object.keys(results).length;
      if (okCount === total) {
        toast.show(`All ${total} sources refreshed`);
      } else {
        toast.show(`${okCount}/${total} sources refreshed — check Sync Health`, "error");
      }
      router.refresh();
      fetchStatus();
    } catch {
      toast.show("Refresh failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
          padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--border)", background: "var(--surface-2)",
          color: "var(--text-primary)", fontSize: 12, cursor: loading ? "default" : "pointer",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
          <path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {loading ? "Refreshing…" : "Refresh data"}
        <style jsx>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </button>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
        Last synced {timeAgo(lastSyncedAt)}
      </div>
    </div>
  );
}
