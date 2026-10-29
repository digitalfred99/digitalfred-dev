import { NextRequest, NextResponse } from "next/server";

// Origins allowed to call the API from a browser. Production: set ALLOWED_ORIGINS (comma-separated).
// Unset => browsers from other origins are blocked (fails closed). Same-origin calls never need CORS.
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];
const configured = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
const isProd = process.env.NODE_ENV === "production";
const allowedOrigins = new Set(isProd ? configured : [...DEV_ORIGINS, ...configured]);

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = new Headers();
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer"); // proposal tokens live in URLs: never leak them via Referer
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: "/api/:path*" };
