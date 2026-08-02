import { NextRequest, NextResponse } from "next/server";

const GUMROAD_PRODUCTS_URL = "https://api.gumroad.com/v2/products";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(GUMROAD_PRODUCTS_URL, {
      headers: { Authorization: `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}` },
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Gumroad products fetch failed: ${res.status}`, body: text }, { status: 500 });
    }
    const json = JSON.parse(text);

    return NextResponse.json({
      topLevelKeys: Object.keys(json),
      productCount: json.products?.length ?? null,
      success: json.success,
      // Show any field that might hint at pagination, without dumping all product data.
      possiblePaginationFields: Object.fromEntries(
        Object.entries(json).filter(([k]) => k !== "products")
      ),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
