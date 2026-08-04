"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#F2F3EE", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>ättic</span>
      </div>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 18, color: "#2C2A26", marginBottom: 6 }}>Something went wrong</div>
        <p style={{ fontSize: 13, color: "#8A867B" }}>
          This page hit an error loading its data. This is usually temporary — try again, and if it keeps happening, check Sync Health for a connector that might be failing.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "#2C2A26", color: "#FBFCF6", fontSize: 13, cursor: "pointer" }}
        >
          Try again
        </button>
        <a href="/" style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #D8D8C7", color: "#2C2A26", fontSize: 13, textDecoration: "none" }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
