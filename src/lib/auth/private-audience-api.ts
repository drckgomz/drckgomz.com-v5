export type PrivateAudienceUser = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  provisioned: boolean;
  emailVerified: boolean;
  enabled: boolean;
  banned: boolean;
  isOwner: boolean;
  hasAdminAccess: boolean;
  canViewPrivate: boolean;
  createdAt: string;
};

export type AudienceListResult = { kind: "ok"; users: PrivateAudienceUser[]; total: number } | { kind: "forbidden" };
export type AudienceChangeResult =
  | { kind: "ok"; changed: boolean }
  | { kind: "forbidden" }
  | { kind: "self-change" }
  | { kind: "not-found" }
  | { kind: "blocked" };

export type PrivateAudienceDependencies = {
  getUserId: () => Promise<string | null>;
  list: (actorId: string, limit: number, offset: number) => Promise<AudienceListResult>;
  setGrant: (actorId: string, targetId: string, grant: boolean) => Promise<AudienceChangeResult>;
};

function privateResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" },
  });
}

function pagination(request: Request): { limit: number; offset: number } | null {
  const query = new URL(request.url).searchParams;
  const limitRaw = query.get("limit");
  const offsetRaw = query.get("offset");
  const limit = limitRaw === null ? 50 : Number(limitRaw);
  const offset = offsetRaw === null ? 0 : Number(offsetRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) return null;
  return { limit, offset };
}

export function createPrivateAudienceHandlers(deps: PrivateAudienceDependencies) {
  return {
    async GET(request: Request): Promise<Response> {
      try {
        const actorId = await deps.getUserId();
        if (!actorId) return privateResponse({ error: "Unauthorized" }, 401);
        const page = pagination(request);
        if (!page) return privateResponse({ error: "Invalid pagination" }, 400);
        const result = await deps.list(actorId, page.limit, page.offset);
        if (result.kind === "forbidden") return privateResponse({ error: "Forbidden" }, 403);
        return privateResponse({
          users: result.users,
          total: result.total,
          nextOffset: page.offset + result.users.length < result.total ? page.offset + result.users.length : null,
        });
      } catch {
        return privateResponse({ error: "Private access list unavailable" }, 500);
      }
    },

    async PATCH(request: Request): Promise<Response> {
      try {
        const origin = request.headers.get("origin");
        if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
          return privateResponse({ error: "Forbidden origin" }, 403);
        }
        const actorId = await deps.getUserId();
        if (!actorId) return privateResponse({ error: "Unauthorized" }, 401);
        const body: unknown = await request.json().catch(() => null);
        if (!body || typeof body !== "object" || Array.isArray(body)) return privateResponse({ error: "Invalid request" }, 400);
        const values = body as Record<string, unknown>;
        if (Object.keys(values).length !== 2 || typeof values.userId !== "string" || !values.userId.trim() || values.userId.length > 200 || typeof values.grant !== "boolean") {
          return privateResponse({ error: "Invalid request" }, 400);
        }
        const result = await deps.setGrant(actorId, values.userId, values.grant);
        if (result.kind === "forbidden") return privateResponse({ error: "Forbidden" }, 403);
        if (result.kind === "self-change") return privateResponse({ error: "Self-service access changes are not allowed" }, 403);
        if (result.kind === "not-found") return privateResponse({ error: "User not found" }, 404);
        if (result.kind === "blocked") return privateResponse({ error: "Private access cannot be granted to a blocked account" }, 409);
        return privateResponse({ ok: true, canViewPrivate: values.grant, changed: result.changed });
      } catch {
        return privateResponse({ error: "Private access update failed" }, 500);
      }
    },
  };
}
