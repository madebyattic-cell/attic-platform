import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { ORDERS_TABS } from "@/components/nav-tabs";

export default function CreativeMarketOrdersPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={ORDERS_TABS} active="Creative Market" />
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Creative Market Orders
        </h1>
        <div style={{ marginTop: 20, background: "var(--surface-1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 24, maxWidth: 480 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            No automated sync exists for Creative Market — they don't offer a seller API, so sales data has to
            come from a manual CSV export. Nothing is wired up here yet.
          </p>
        </div>
      </div>
    </div>
  );
}
