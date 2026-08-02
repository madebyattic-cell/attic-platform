import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { FINANCES_TABS } from "@/components/nav-tabs";
import Link from "next/link";

const LINKS = [
  { href: "/finances/income", label: "Income", ready: true, note: "Real revenue data" },
  { href: "/finances/expenses", label: "Expenses", ready: false, note: "Not built yet" },
  { href: "/finances/overview", label: "Overview", ready: false, note: "Blocked on Expenses" },
  { href: "/finances/actions", label: "Actions", ready: false, note: "Needs scoping" },
];

export default function FinancesHubPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-0)" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px 32px" }}>
        <TabBar tabs={FINANCES_TABS} active="" />
        <h1 style={{ fontFamily: "var(--font-voice)", fontSize: 22, color: "var(--text-primary)", margin: 0 }}>
          Finances
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
              <div style={{ background: "var(--surface-1)", borderRadius: 10, padding: "16px", border: "0.5px solid var(--border)" }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{l.label}</div>
                <div style={{ fontSize: 11, color: l.ready ? "var(--text-success)" : "var(--text-muted)", marginTop: 6 }}>{l.note}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
