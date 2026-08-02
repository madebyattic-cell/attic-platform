import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { FINANCES_TABS } from "@/components/nav-tabs";

export function FinancePlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={FINANCES_TABS} active={title} />
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          {title}
        </h1>
        <div style={{ marginTop: 20, background: "var(--surface-1)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 24, maxWidth: 480 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{note}</p>
        </div>
      </div>
    </div>
  );
}
