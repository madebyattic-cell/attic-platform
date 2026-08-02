"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
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

const TOP_LEVEL = [
  { href: "/listings", label: "Catalog", icon: ICONS.folder },
  { href: "/orders", label: "Orders", icon: ICONS.bag },
  { href: "/performance", label: "Sales", icon: ICONS.bag },
  { href: "/customers", label: "Customers", icon: ICONS.smiley },
  { href: "/analytics", label: "Analytics", icon: ICONS.chart },
  { href: "/finances", label: "Finances", icon: ICONS.banknote },
  { href: "/settings", label: "Tools", icon: ICONS.grid },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div
      style={{
        background: "var(--surface-1)",
        borderRight: "0.5px solid var(--border)",
        width: 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        overflowY: "auto",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", marginBottom: 16, textDecoration: "none" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-hidden
        >
          <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>ättic</span>
        </div>
        <span style={{ fontSize: 15, color: "var(--text-primary)" }}>Made by Attic</span>
      </Link>

      <div style={{ marginBottom: 14 }}>
        <RefreshButton />
      </div>

      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 14px",
          borderRadius: 999,
          background: pathname === "/" ? "var(--surface-2)" : "transparent",
          color: "var(--text-primary)",
          fontSize: 15,
          textDecoration: "none",
          marginBottom: 4,
        }}
      >
        {ICONS.compass}
        Dashboard
      </Link>

      {TOP_LEVEL.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 14px",
            borderRadius: 999,
            color: "var(--text-primary)",
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </div>
  );
}
