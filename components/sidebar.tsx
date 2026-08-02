"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavLink = { href: string; label: string };
type NavSection = { label: string; icon: string; links: NavLink[] };

const SECTIONS: NavSection[] = [
  {
    label: "All Products",
    icon: "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7",
    links: [
      { href: "/listings", label: "Mockups" },
      { href: "/series", label: "Series" },
      { href: "/listings?kind=bundle", label: "Bundles" },
      { href: "/listings?category=visuals", label: "Visuals" },
    ],
  },
  {
    label: "Orders",
    icon: "M3 3h18v4H3zM3 7l2 13h14l2-13",
    links: [
      { href: "/orders/wix", label: "Wix Studio" },
      { href: "/orders/gumroad", label: "Gumroad" },
      { href: "/orders/creative-market", label: "Creative Market" },
      { href: "/orders/behance", label: "Behance" },
    ],
  },
  {
    label: "Sales",
    icon: "M3 3h18v4H3zM3 7l2 13h14l2-13",
    links: [
      { href: "/performance?view=best", label: "Best Selling" },
      { href: "/performance?view=low", label: "Low Performing" },
      { href: "/listings?status=retired", label: "Discontinue" },
      { href: "/listings?status=archived", label: "Archive" },
    ],
  },
  {
    label: "Customers",
    icon: "M12 15a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0",
    links: [
      { href: "/segments?segment=champions", label: "Champions" },
      { href: "/segments?segment=loyal", label: "Loyal" },
      { href: "/segments?segment=potential_loyalist", label: "Potential" },
      { href: "/segments?segment=new", label: "New" },
      { href: "/segments?segment=at_risk", label: "At Risk" },
      { href: "/segments?segment=lost", label: "Lost" },
    ],
  },
  {
    label: "Analytics",
    icon: "M4 19V9m6 10V5m6 14v-7",
    links: [
      { href: "/performance", label: "Product Scoring" },
      { href: "/segments", label: "Client Scoring" },
      { href: "/seo-diagnostics", label: "Seo Problems" },
      { href: "/", label: "Shop Overview" },
      { href: "/analytics", label: "All Time Analytics" },
      { href: "/sync-health", label: "Problems" },
    ],
  },
  {
    label: "Finances",
    icon: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    links: [
      { href: "/finances/income", label: "Income" },
      { href: "/finances/expenses", label: "Expenses" },
      { href: "/finances/overview", label: "Overview" },
      { href: "/finances/actions", label: "Actions" },
    ],
  },
  {
    label: "Tools",
    icon: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    links: [{ href: "/settings", label: "Settings" }],
  },
];

function SectionIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} style={{ flexShrink: 0 }}>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
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
        padding: "14px 10px",
        overflowY: "auto",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", marginBottom: 6, textDecoration: "none" }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "conic-gradient(from 0deg, #C1653B, #6B7355, #8C6E4A, #C1653B)", flexShrink: 0 }} aria-hidden />
        <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Made by Attic</span>
      </Link>

      <Link
        href="/"
        style={{
          display: "block",
          padding: "8px 10px",
          borderRadius: 8,
          background: pathname === "/" ? "var(--surface-2)" : "transparent",
          color: "var(--text-primary)",
          fontSize: 13,
          textDecoration: "none",
          marginBottom: 10,
        }}
      >
        Dashboard
      </Link>

      {SECTIONS.map((section) => {
        const isCollapsed = collapsed[section.label];
        return (
          <div key={section.label} style={{ marginBottom: 2 }}>
            <button
              type="button"
              onClick={() => toggle(section.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 6px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-muted)", width: 10, display: "inline-block", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 0.1s" }}>
                ▸
              </span>
              <SectionIcon d={section.icon} />
              {section.label}
            </button>
            {!isCollapsed && (
              <div style={{ marginLeft: 30, marginBottom: 8 }}>
                {section.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    style={{
                      display: "block",
                      padding: "5px 8px",
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
            )}
          </div>
        );
      })}
    </div>
  );
}
