import { NextRequest, NextResponse } from "next/server";

const WIX_PRODUCTS_QUERY_URL = "https://www.wixapis.com/stores/v1/products/query";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(WIX_PRODUCTS_QUERY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.WIX_API_KEY!,
        "wix-account-id": process.env.WIX_ACCOUNT_ID!,
        "wix-site-id": process.env.WIX_SITE_ID!,
      },
      body: JSON.stringify({
        query: { paging: { limit: 10, offset: 0 } },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Wix products query failed: ${res.status}`, body: text }, { status: 500 });
    }

    const json = JSON.parse(text);
    const products = (json.products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      priceData: p.priceData,
      sku: p.sku,
      productType: p.productType,
      collectionIds: p.collectionIds,
    }));

    return NextResponse.json({ total: json.totalResults, sample: products });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
