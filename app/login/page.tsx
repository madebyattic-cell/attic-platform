"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F2F3EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} style={{ background: "#EDEDE4", borderRadius: 22, padding: 32, width: 320, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>ättic</span>
          </div>
          <span style={{ fontSize: 15, color: "#2C2A26" }}>Made by Attic</span>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ height: 40, borderRadius: 10, border: "1px solid #D8D8C7", padding: "0 12px", fontSize: 14 }}
        />
        {error && <span style={{ fontSize: 12, color: "#C62828" }}>{error}</span>}
        <button
          type="submit"
          disabled={loading}
          style={{ height: 40, borderRadius: 10, border: "none", background: "#2C2A26", color: "#FBFCF6", fontSize: 14, cursor: "pointer" }}
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
