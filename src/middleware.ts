// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { BackendConfigurationError, getBackendConfiguration } from "@/lib/backend-configuration";
import { isOfflineDesignMode, isOfflineDesignRouteAllowed } from "@/lib/offline-design-mode";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

function isPersonalizedRoute(req: NextRequest) {
  return /^\/admin(?:\/|$)/.test(req.nextUrl.pathname) || /^\/blog(?:\/|$)/.test(req.nextUrl.pathname);
}

function applyResponsePolicy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/admin/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.headers.get("sec-fetch-site") === "cross-site" || !isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Forbidden origin" }, {
        status: 403, headers: { "Cache-Control": "private, no-store" },
      });
    }
  }
  const response = NextResponse.next();
  // Never put personalized data, credentials, or signed upload URLs in shared caches.
  if (req.nextUrl.pathname.startsWith("/api/") || isPersonalizedRoute(req)) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export default async function middleware(req: NextRequest) {
  let offlineDesignMode: boolean;
  try {
    offlineDesignMode = isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE });
  } catch (error) {
    if (error instanceof Error && error.name === "OfflineDesignConfigurationError") {
      return NextResponse.json({ error: "Offline design mode is unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    throw error;
  }

  if (offlineDesignMode) {
    if (isOfflineDesignRouteAllowed(req.nextUrl.pathname)) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }

  let backend;
  try { backend = getBackendConfiguration(); }
  catch (error) {
    if (error instanceof BackendConfigurationError) {
      return NextResponse.json({ error: "Backend integration is unavailable" }, {
        status: 503, headers: { "Cache-Control": "private, no-store" },
      });
    }
    throw error;
  }
  // Better Auth is the only configured runtime. Route handlers and server
  // components perform session and role checks; middleware never trusts cookies.
  if (backend.auth !== "better-auth") {
    return NextResponse.json({ error: "Authentication backend unavailable" }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
  return applyResponsePolicy(req);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
