import type { Tab } from "./tab-bar";

export const CATALOG_TABS: Tab[] = [
  { href: "/listings", label: "All Products" },
  { href: "/listings?kind=mockup", label: "Mockups" },
  { href: "/series", label: "Series" },
  { href: "/listings?kind=bundle", label: "Bundles" },
  { href: "/listings?category=visuals", label: "Visuals" },
];

export const ORDERS_TABS: Tab[] = [
  { href: "/orders/wix", label: "Wix Studio" },
  { href: "/orders/gumroad", label: "Gumroad" },
  { href: "/orders/creative-market", label: "Creative Market" },
  { href: "/orders/behance", label: "Behance" },
];

export const SALES_TABS: Tab[] = [
  { href: "/performance?view=best", label: "Best Selling" },
  { href: "/performance?view=low", label: "Low Performing" },
  { href: "/listings?status=retired", label: "Discontinue" },
  { href: "/listings?status=archived", label: "Archive" },
];

export const CUSTOMERS_TABS: Tab[] = [
  { href: "/customers", label: "All Customers" },
  { href: "/segments?segment=champions", label: "Champions" },
  { href: "/segments?segment=loyal", label: "Loyal" },
  { href: "/segments?segment=potential_loyalist", label: "Potential" },
  { href: "/segments?segment=new", label: "New" },
  { href: "/segments?segment=at_risk", label: "At Risk" },
  { href: "/segments?segment=lost", label: "Lost" },
];

export const ANALYTICS_TABS: Tab[] = [
  { href: "/", label: "Shop Overview" },
  { href: "/performance", label: "Product Scoring" },
  { href: "/segments", label: "Client Scoring" },
  { href: "/seo-diagnostics", label: "Seo Problems" },
  { href: "/analytics", label: "All Time Analytics" },
  { href: "/sync-health", label: "Problems" },
];

export const FINANCES_TABS: Tab[] = [
  { href: "/finances/income", label: "Income" },
  { href: "/finances/expenses", label: "Expenses" },
  { href: "/finances/overview", label: "Overview" },
  { href: "/finances/actions", label: "Actions" },
];
