import { NextResponse } from "next/server";
import { syncWixOrders } from "@/lib/sync/wix";
import { syncGumroadSales } from "@/lib/sync/gumroad";
import { syncGa4PageViews } from "@/lib/sync/ga4";
import { syncSearchConsole } from "@/lib/sync/gsc";

export const maxDuration = 60;

async function safeRun<T>(name: string, fn: () => Promise<T>) {
  try {
    const result = await fn();
    return { name, ok: true, result };
  } catch (err) {
    return { name, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const [wix, gumroad, ga4, gsc] = await Promise.all([
    safeRun("wix_orders", syncWixOrders),
    safeRun("gumroad_sales", syncGumroadSales),
    safeRun("ga4", syncGa4PageViews),
    safeRun("gsc", () => syncSearchConsole(recentDate(14))),
  ]);

  const results = { wix_orders: wix, gumroad_sales: gumroad, ga4, gsc };
  return NextResponse.json({ ok: true, results });
}
