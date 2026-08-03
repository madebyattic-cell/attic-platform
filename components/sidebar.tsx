"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { RefreshButton } from "./refresh-button";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const ICONS = {
  compass: (
    <Icon>
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  folder: (
    <Icon>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  bag: (
    <Icon>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10a4 4 0 01-8 0" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  smiley: (
    <Icon>
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 19V9m6 10V5m6 14v-7" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  banknote: (
    <Icon>
      <rect x="2" y="6" width="20" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="6" y1="12" x2="6.01" y2="12" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="18" y1="12" x2="18.01" y2="12" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
  grid: (
    <Icon>
      <circle cx="6" cy="6" r="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="6" r="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  ),
};

// Flat items link straight to their hub page — filtering lives as tabs
// on that page. Expandable items show their destinations right here too.
const FLAT_ITEMS = [
  { href: "/listings", label: "Catalog", icon: ICONS.folder },
];

const EXPANDABLE: { label: string; icon: ReactNode; hubHref: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Orders",
    icon: ICONS.bag,
    hubHref: "/orders",
    links: [
      { href: "/orders/wix", label: "Wix Studio" },
      { href: "/orders/gumroad", label: "Gumroad" },
      { href: "/orders/creative-market", label: "Creative Market" },
      { href: "/orders/behance", label: "Behance" },
    ],
  },
];

const AFTER_ORDERS = [{ href: "/performance", label: "Sales", icon: ICONS.bag }, { href: "/customers", label: "Customers", icon: ICONS.smiley }];

const EXPANDABLE_2: { label: string; icon: ReactNode; hubHref: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Analytics",
    icon: ICONS.chart,
    hubHref: "/analytics",
    links: [
      { href: "/analytics", label: "All Time" },
      { href: "/", label: "Shop Overview" },
      { href: "/performance", label: "Product Scoring" },
      { href: "/segments", label: "Client Scoring" },
      { href: "/seo-diagnostics", label: "Seo Problems" },
      { href: "/sync-health", label: "Problems" },
    ],
  },
];

const AFTER_ANALYTICS = [
  { href: "/finances", label: "Finances", icon: ICONS.banknote },
  { href: "/settings", label: "Tools", icon: ICONS.grid },
];

function FlatLink({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
        borderRadius: 999,
        color: "var(--text-primary)",
        fontSize: 15,
        textDecoration: "none",
        background: active ? "var(--surface-2)" : "transparent",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function ExpandableSection({ section }: { section: (typeof EXPANDABLE)[number] }) {
    const isCollapsed = collapsed[section.label];
    return (
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <button
            type="button"
            onClick={() => toggle(section.label)}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            style={{ background: "transparent", border: "none", padding: "6px 4px 6px 2px", cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}
          >
            <span style={{ display: "inline-block", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.15s" }}>
              ▸
            </span>
          </button>
          <Link
            href={section.hubHref}
            style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "6px 6px 6px 0", color: "var(--text-primary)", fontSize: 15, textDecoration: "none" }}
          >
            {section.icon}
            {section.label}
          </Link>
        </div>
        {!isCollapsed && (
          <div style={{ marginLeft: 40, marginTop: 4, display: "flex", flexDirection: "column", gap: 6 }}>
            {section.links.map((l) => (
              <Link key={l.href} href={l.href} style={{ padding: "5px 6px", color: "var(--text-secondary)", fontSize: 15, textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderRight: "0.5px solid var(--border)",
        width: 210,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        overflowY: "auto",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", marginBottom: 16, textDecoration: "none" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden>
          <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>ättic</span>
        </div>
        <span style={{ fontSize: 15, color: "var(--text-primary)" }}>Made by Attic</span>
      </Link>

      <div style={{ marginBottom: 14 }}>
        <RefreshButton />
      </div>

      <FlatLink href="/" label="Dashboard" icon={ICONS.compass} active={pathname === "/"} />
      <div style={{ height: 8 }} />

      {FLAT_ITEMS.map((item) => (
        <div key={item.label} style={{ marginBottom: 4 }}>
          <FlatLink href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
        </div>
      ))}

      {EXPANDABLE.map((section) => (
        <ExpandableSection key={section.label} section={section} />
      ))}

      {AFTER_ORDERS.map((item) => (
        <div key={item.label} style={{ marginBottom: 4 }}>
          <FlatLink href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
        </div>
      ))}

      {EXPANDABLE_2.map((section) => (
        <ExpandableSection key={section.label} section={section} />
      ))}

      {AFTER_ANALYTICS.map((item) => (
        <div key={item.label} style={{ marginBottom: 4 }}>
          <FlatLink href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} />
        </div>
      ))}
    </div>
  );
}
