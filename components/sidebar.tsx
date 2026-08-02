import Link from "next/link";

const SECTIONS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "CATALOG",
    links: [
      { href: "/listings", label: "Listings" },
      { href: "/series", label: "Series" },
      { href: "/products/new", label: "Add product" },
    ],
  },
  {
    label: "INSIGHTS",
    links: [
      { href: "/performance", label: "Performance" },
      { href: "/analytics", label: "Analytics" },
      { href: "/seo-diagnostics", label: "SEO Diagnostics" },
    ],
  },
  {
    label: "CUSTOMERS",
    links: [
      { href: "/customers", label: "All Customers" },
      { href: "/segments", label: "Segments" },
    ],
  },
  {
    label: "OPERATIONS",
    links: [
      { href: "/reconcile/gumroad", label: "Gumroad Matches" },
      { href: "/reconcile/orders", label: "Order Attribution" },
      { href: "/sync-health", label: "Sync Health" },
    ],
  },
];

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
        overflowY: "auto",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 20, textDecoration: "none" }}>
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
      </Link>

      {SECTIONS.map((section) => (
        <div key={section.label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "0 8px", marginBottom: 4, letterSpacing: 0.5 }}>
            {section.label}
          </div>
          {section.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: "block",
                padding: "6px 8px",
                borderRadius: 6,
                color: "var(--text-secondary)",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
