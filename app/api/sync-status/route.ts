import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  const result = await db.execute<{ finished_at: string | null }>(sql`
    select max(finished_at)::text as finished_at from sync_runs where status = 'ok'
  `);
  return NextResponse.json({ lastSyncedAt: result.rows[0]?.finished_at ?? null });
}
