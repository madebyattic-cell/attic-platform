import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.ATTIC_ACCESS_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: "ATTIC_ACCESS_PASSWORD is not set on the server." }, { status: 500 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("attic_auth", expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
