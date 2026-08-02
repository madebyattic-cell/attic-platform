import Link from "next/link";

export type Tab = { href: string; label: string };

export function TabBar({ tabs, active }: { tabs: Tab[]; active: string }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--border)", marginBottom: 20, paddingBottom: 0 }}>
      {tabs.map((t) => {
        const isActive = t.label === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: "8px 14px",
              fontSize: 14,
              textDecoration: "none",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
