import { NextResponse } from "next/server";
import { listLocalAuthMessages } from "@/lib/auth/local-mailbox";
import { getBetterAuth } from "@/lib/auth/better-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const messages = await listLocalAuthMessages();
    return NextResponse.json({ messages: messages.map(({ id, kind, email, createdAt }) => ({ id, kind, email, createdAt })) }, {
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  } catch {
    return NextResponse.json({ error: "Local email inbox is unavailable" }, {
      status: 404, headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function POST(request: Request) {
  if (!isLocalRequest(request) || request.headers.get("origin") !== "http://localhost:3000" ||
      !(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid local email action" }, { status: 400 });
    const item = body as Record<string, unknown>;
    if (typeof item.token !== "string" || item.token.length < 16 || item.token.length > 2048 ||
        (item.kind !== "email-verification" && item.kind !== "password-reset")) {
      return NextResponse.json({ error: "Invalid local email action" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (item.kind === "password-reset") return NextResponse.json({ error: "Use the local inbox reset form" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const target = new URL("/api/auth/verify-email", "http://localhost:3000");
    target.searchParams.set("token", item.token);
    target.searchParams.set("callbackURL", "http://localhost:3000/blog");
    const response = await getBetterAuth().handler(new Request(target, {
      method: "GET",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    }));
    const location = response.headers.get("location");
    if (response.status >= 400 || (location && new URL(location, "http://localhost:3000").searchParams.has("error"))) {
      return NextResponse.json({ error: "Verification link is expired or invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const verified = NextResponse.json({ kind: item.kind, verified: true }, { headers: { "Cache-Control": "no-store" } });
    for (const cookie of response.headers.getSetCookie()) verified.headers.append("set-cookie", cookie);
    return verified;
  } catch {
    return NextResponse.json({ error: "Local email action failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

function isLocalRequest(request: Request) {
  const host = request.headers.get("host")?.toLowerCase();
  const requestedHost = new URL(request.url).hostname.toLowerCase();
  return new Set(["localhost:3000", "127.0.0.1:3000"]).has(host ?? "") &&
    new Set(["localhost", "127.0.0.1"]).has(requestedHost);
}
