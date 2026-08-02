import { Sidebar } from "@/components/sidebar";

export default function SettingsPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Settings
        </h1>
        <div style={{ marginTop: 20, background: "var(--surface-1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 24, maxWidth: 480 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Nothing configurable here yet — placeholder for whatever settings turn out to matter (channel fee
            rates, taxonomy, etc).
          </p>
        </div>
      </div>
    </div>
  );
}
