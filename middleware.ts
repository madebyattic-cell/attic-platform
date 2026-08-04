import { NextRequest, NextResponse } from "next/server";

const BYPASS_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/_next",
  "/favicon.ico",
  "/api/sync",
  "/api/backfill",
  "/api/import",
  "/api/debug",
  "/api/refresh-all",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("attic_auth")?.value;
  const expected = process.env.ATTIC_ACCESS_PASSWORD;

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
