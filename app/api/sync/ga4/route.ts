import { NextRequest, NextResponse } from "next/server";
import { syncGa4PageViews } from "@/lib/sync/ga4";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  console.log("DEBUG auth:", JSON.stringify(auth));
  console.log("DEBUG expected:", JSON.stringify(`Bearer ${process.env.CRON_SECRET}`));
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGa4PageViews();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
