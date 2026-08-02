import Link from "next/link";

const links = [
  { href: "/", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/listings", label: "Listings", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" },
  { href: "/customers", label: "Customers", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" },
  { href: "/analytics", label: "Analytics", icon: "M9 19V6l7 5-7 5z" },
];

export function Sidebar() {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderRight: "0.5px solid var(--border)",
        width: 60,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "18px 0",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background:
            "conic-gradient(from 0deg, #C1653B, #6B7355, #8C6E4A, #C1653B)",
        }}
        aria-hidden
      />
      <div
        style={{
          height: 1,
          width: 24,
          background: "var(--border)",
          margin: "2px 0",
        }}
      />
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          title={l.label}
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d={l.icon} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </div>
  );
}
