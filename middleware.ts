import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 20;

  const entry = rateLimitMap.get(ip);
  if (entry && now - entry.timestamp < windowMs) {
    if (entry.count >= maxRequests) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
