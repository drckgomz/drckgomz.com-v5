import { getViewer } from "@/lib/auth/viewer";
import { isAdmin } from "@/lib/auth/policy";
import { privateJson } from "@/lib/auth/response";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId: actorId, profile: actor } = await getViewer();
    if (!actorId) return privateJson({ error: "Unauthorized" }, 401);
    if (!actor || !isAdmin(actor)) return privateJson({ error: "Forbidden" }, 403);
    const { id } = await ctx.params;
    // Account settings are separate: no self-service permission or ban changes here.
    if (actor.id === id) return privateJson({ error: "Cannot change your own access" }, 403);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return privateJson({ error: "Invalid JSON body" }, 400);
    }
    const values = body as Record<string, unknown>;
    const fields = ["role", "is_owner", "can_view_private", "is_banned", "banned_reason", "enabled"];
    if (!Object.keys(values).length || Object.keys(values).some((key) => !fields.includes(key))) {
      return privateJson({ error: "Unsupported fields" }, 400);
    }
    if ("role" in values && values.role !== "admin" && values.role !== "user") {
      return privateJson({ error: "Invalid role" }, 400);
    }
    for (const flag of ["is_owner", "can_view_private", "is_banned", "enabled"]) {
      if (flag in values && typeof values[flag] !== "boolean") {
        return privateJson({ error: "Invalid flag" }, 400);
      }
    }
    if ("banned_reason" in values && values.banned_reason !== null && typeof values.banned_reason !== "string") {
      return privateJson({ error: "Invalid reason" }, 400);
    }
    if (("role" in values || "is_owner" in values || "enabled" in values) && actor.is_owner !== true) {
      return privateJson({ error: "Owner required" }, 403);
    }
    const db = supabaseAdmin();
    const { data: target, error } = await db.from("user_profiles")
      .select("id,role,is_owner,is_whitelist_admin,enabled,is_banned").eq("id", id).maybeSingle();
    if (error) return privateJson({ error: "Profile lookup failed" }, 500);
    if (!target) return privateJson({ error: "Not found" }, 404);
    // Null privilege flags confer nothing. Malformed positive/unknown values are not ordinary users.
    const flags = [target.is_owner, target.is_whitelist_admin];
    if (flags.some((flag) => flag != null && typeof flag !== "boolean") ||
        (target.role != null && typeof target.role !== "string")) {
      return privateJson({ error: "Uncertain target privileges" }, 403);
    }
    const targetIsOwner = target.is_owner === true;
    if (actor.is_owner !== true && (targetIsOwner || (target.role != null && target.role.toLowerCase() !== "user") || target.is_whitelist_admin === true)) {
      return privateJson({ error: "Protected account" }, 403);
    }
    const finalOwner = "is_owner" in values ? values.is_owner : targetIsOwner;
    const finalEnabled = "enabled" in values ? values.enabled : target.enabled;
    const finalBanned = "is_banned" in values ? values.is_banned : target.is_banned;
    if (finalOwner && (finalEnabled !== true || finalBanned !== false)) {
      return privateJson({ error: "An owner must be explicitly enabled and not banned" }, 400);
    }
    if (targetIsOwner) {
      // Counting owners and then writing in a second REST request is racy. Never
      // remove an active-owner capability until a DB transaction can enforce it.
      if (values.is_owner === false || values.is_banned === true || values.enabled === false || "role" in values) {
        return privateJson({ error: "Owner restriction requires atomic database support" }, 409);
      }
      // Another active owner may restore access; this can only add an active owner.
      if (values.is_owner === true) return privateJson({ error: "Already an owner" }, 400);
    }
    const patch: Record<string, unknown> = { ...values };
    if ("is_banned" in patch) {
      patch.banned_at = patch.is_banned ? new Date().toISOString() : null;
      if (!patch.is_banned) patch.banned_reason = null;
    }
    // Compare the actual nullable snapshot, not null-as-false SQL equality. This
    // also prevents promotion/restriction races on the account being recovered.
    let query = db.from("user_profiles").update(patch).eq("id", id);
    for (const field of ["role", "is_owner", "is_whitelist_admin", "enabled", "is_banned"] as const) {
      query = target[field] == null ? query.is(field, null) : query.eq(field, target[field]);
    }
    const result = await query.select("id").maybeSingle();
    if (result.error) return privateJson({ error: "Profile update failed" }, 500);
    if (!result.data) return privateJson({ error: "Profile changed; refresh and retry" }, 409);
    return privateJson({ ok: true });
  } catch {
    return privateJson({ error: "Profile update failed" }, 500);
  }
}
