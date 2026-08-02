import { db } from "@/db/client";
import { orders, channels } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

const WIX_ORDERS_SEARCH_URL = "https://www.wixapis.com/ecom/v1/orders/search";

type WixOrder = { id: string; number?: string };

async function fetchAllWixOrders(): Promise<WixOrder[]> {
  const all: WixOrder[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetch(WIX_ORDERS_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.WIX_API_KEY!,
        "wix-account-id": process.env.WIX_ACCOUNT_ID!,
        "wix-site-id": process.env.WIX_SITE_ID!,
      },
      body: JSON.stringify({ search: { cursorPaging: { limit: 100, cursor } } }),
    });

    if (!res.ok) throw new Error(`Wix orders search failed: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const batch: WixOrder[] = json.orders ?? [];
    all.push(...batch);
    cursor = json.metadata?.cursors?.next;
  } while (cursor);

  return all;
}

export async function fillOrderNumbers() {
  const channel = await db.query.channels.findFirst({ where: eq(channels.key, "wix") });
  if (!channel) throw new Error("No 'wix' row in channels table.");

  const wixOrders = await fetchAllWixOrders();

  const toUpdate = wixOrders.filter((o) => o.number).map((o) => ({ id: o.id, number: o.number! }));

  let updated = 0;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const batch = toUpdate.slice(i, i + CHUNK_SIZE);
    const values = batch.map((o) => sql`(${o.id}, ${o.number})`);

    const result = await db.execute(sql`
      UPDATE orders AS o
      SET order_number = v.number
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(external_id, number)
      WHERE o.external_order_id = v.external_id
        AND o.channel_id = ${channel.id}::uuid
    `);
    updated += result.rowCount ?? 0;
  }

  return { ok: true, totalWixOrders: wixOrders.length, withNumber: toUpdate.length, updated };
}
