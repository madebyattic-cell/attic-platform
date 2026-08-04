"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast-provider";

const CHANNEL_OPTIONS = [
  { value: "wix", label: "Wix" },
  { value: "gumroad", label: "Gumroad" },
  { value: "behance", label: "Behance" },
  { value: "creative_market", label: "Creative Market" },
];

export function ManualViewsForm({ productId }: { productId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [channelKey, setChannelKey] = useState("behance");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [views, setViews] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/manual-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelKey, date, views: Number(views) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.show("Views saved");
      setViews("");
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : String(err), "error");
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
    </form>
  );
}
