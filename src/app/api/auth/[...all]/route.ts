import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { getBetterAuth } from "@/lib/auth/better-auth";
import { withoutSessionToken } from "@/lib/auth/public-session-payload";
import { isMissingConfigurationError } from "@/lib/db/config";
import { BackendConfigurationError, getBackendConfiguration } from "@/lib/backend-configuration";
import { isStrongPassword, validateRegistrationInput } from "@/lib/auth/password-policy";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    getBackendConfiguration();
    const pathname = new URL(request.url).pathname;
    if (request.method === "POST" && (pathname.endsWith("/sign-up/email") || pathname.endsWith("/reset-password"))) {
      const body: unknown = await request.clone().json().catch(() => null);
      const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const password = value.password ?? value.newPassword;
      if (!isStrongPassword(password)) {
        return NextResponse.json({ message: "Use 12–128 characters with lowercase, uppercase, and a number or symbol." }, {
          status: 400, headers: { "Cache-Control": "no-store" },
        });
      }
      if (pathname.endsWith("/sign-up/email")) {
        if (!validateRegistrationInput(value)) {
          return NextResponse.json({ message: "Enter a valid display name and email address." }, {
            status: 400, headers: { "Cache-Control": "no-store" },
          });
        }
      }
    }
    const handlers = toNextJsHandler(getBetterAuth());
    const response = await (request.method === "GET" ? handlers.GET(request) : handlers.POST(request));
    if (!new URL(request.url).pathname.endsWith("/get-session")) return response;
    const payload: unknown = await response.clone().json().catch(() => null);
    if (!payload || typeof payload !== "object" || !("session" in payload)) return response;
    const safePayload = withoutSessionToken(payload);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
    headers.set("Cache-Control", "private, no-store");
    return new Response(JSON.stringify(safePayload), { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json({ error: "Authentication integration is unavailable" }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    if (isMissingConfigurationError(error)) {
      return NextResponse.json({ error: "Authentication is not configured", missing: error.missing }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ error: "Authentication service unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = handle;
export const POST = handle;
