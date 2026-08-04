"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DashboardHeader({ failedSyncCount }: { failedSyncCount: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: 420 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#8A867B" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, customers, orders..."
            style={{ width: "100%", height: 40, borderRadius: 999, border: "none", background: "#FBFCF6", paddingLeft: 40, fontSize: 13 }}
          />
        </div>
      </form>
      <button
        type="button"
        onClick={() => router.push("/sync-health")}
        style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", background: "#FBFCF6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-label="Notifications"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2C2A26" strokeWidth={1.8}>
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {failedSyncCount > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, width: 9, height: 9, borderRadius: "50%", background: "#C62828" }} />
        )}
      </button>
    </div>
  );
}
