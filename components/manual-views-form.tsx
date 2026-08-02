"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHANNEL_OPTIONS = [
  { value: "wix", label: "Wix" },
  { value: "gumroad", label: "Gumroad" },
  { value: "behance", label: "Behance" },
  { value: "creative_market", label: "Creative Market" },
];

export function ManualViewsForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [channelKey, setChannelKey] = useState("behance");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [views, setViews] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/products/${productId}/manual-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelKey, date, views: Number(views) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSuccess(true);
      setViews("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        value={channelKey}
        onChange={(e) => setChannelKey(e.target.value)}
        style={{ padding: "5px 8px", fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 6 }}
      >
        {CHANNEL_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ padding: "5px 8px", fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 6 }}
      />
      <input
        type="number"
        min="0"
        placeholder="Views"
        value={views}
        onChange={(e) => setViews(e.target.value)}
        required
        style={{ width: 90, padding: "5px 8px", fontSize: 12, border: "0.5px solid var(--border)", borderRadius: 6 }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{ padding: "5px 12px", fontSize: 12, borderRadius: 6, border: "none", background: "var(--text-primary)", color: "var(--surface-0)", cursor: "pointer" }}
      >
        {loading ? "Saving…" : "Add views"}
      </button>
      {success && <span style={{ fontSize: 11, color: "var(--text-success)" }}>Saved</span>}
      {error && <span style={{ fontSize: 11, color: "#C62828" }}>{error}</span>}
    </form>
  );
}
