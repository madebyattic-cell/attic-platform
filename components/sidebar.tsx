import Link from "next/link";

const mainLinks = [
  { href: "/", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/listings", label: "Listings", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" },
  { href: "/series", label: "Series", icon: "M4 6h16M4 12h16M4 18h7" },
  { href: "/performance", label: "Performance", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { href: "/customers", label: "Customers", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" },
  { href: "/analytics", label: "Analytics", icon: "M9 19V6l7 5-7 5z" },
  { href: "/products/new", label: "Add product", icon: "M12 4v16m8-8H4" },
];

const comingSoonLinks: typeof mainLinks = [];

const reconcileLinks = [
  { href: "/reconcile/gumroad", label: "Gumroad matches" },
  { href: "/reconcile/orders", label: "Order attribution" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ flexShrink: 0 }}>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderRight: "0.5px solid var(--border)",
        width: 190,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "18px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 16 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, #C1653B, #6B7355, #8C6E4A, #C1653B)",
            flexShrink: 0,
          }}
          aria-hidden
        />
        <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Made by Attic</span>
      </div>

      {mainLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 8px",
            borderRadius: 6,
            color: "var(--text-secondary)",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <NavIcon d={l.icon} />
          {l.label}
        </Link>
      ))}

      <div style={{ height: 1, background: "var(--border)", margin: "10px 4px" }} />

      <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "0 8px", marginBottom: 4 }}>
        RECONCILE
      </div>
      {reconcileLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            display: "block",
            padding: "6px 8px",
            borderRadius: 6,
            color: "var(--text-secondary)",
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          {l.label}
        </Link>
      ))}

      <div style={{ height: 1, background: "var(--border)", margin: "10px 4px" }} />

      <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "0 8px", marginBottom: 4 }}>
        COMING SOON
      </div>
      {comingSoonLinks.map((l) => (
        <div
          key={l.href}
          title="Not built yet"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 8px",
            borderRadius: 6,
            color: "var(--text-muted)",
            fontSize: 13,
            opacity: 0.5,
            cursor: "default",
          }}
        >
          <NavIcon d={l.icon} />
          {l.label}
        </div>
      ))}
    </div>
  );
}
