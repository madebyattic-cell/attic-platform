import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ORDERS_TABS } from "@/components/nav-tabs";

export default function BehanceOrdersPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ORDERS_TABS} active="Behance" />
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Behance
        </h1>
        <div style={{ marginTop: 20, background: "var(--surface-1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 24, maxWidth: 480 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Behance is a portfolio channel, not a sales channel — no orders happen there. This entry exists in
            the nav mainly as a placeholder in case that changes.
          </p>
        </div>
      </div>
    </div>
  );
}
