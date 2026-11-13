import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { authUsers, securityAuditEvents, userProfiles, userRoles } from "@/lib/db/schema";
import { initialOwnerDenial } from "@/lib/auth/owner-bootstrap-policy";

const OWNER_BOOTSTRAP_LOCK = 74267123;

/**
 * One-time operator procedure, never exposed as an HTTP action.
 * Provision and verify the Better Auth identity first; then invoke only after
 * a separate development-branch/owner approval. This routine grants exactly
 * the first owner in one serialized DB transaction and cannot elevate imports.
 */
export async function bootstrapFirstOwner(input: {
  userId: string;
  separatelyApproved: boolean;
  evidenceRef: string;
}) {
  // This entry point is invoked only by the separately gated one-shot
  // development bootstrap runner, which uses its dedicated limited role.
  const db = getDatabase("drckgomz_bootstrap");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${OWNER_BOOTSTRAP_LOCK})`);
    const [ownerCount] = await tx.select({ count: sql<number>`count(*)::int` })
      .from(userRoles)
      .where(eq(userRoles.role, "owner"));
    const [identity] = await tx.select({ id: authUsers.id, emailVerified: authUsers.emailVerified })
      .from(authUsers).where(eq(authUsers.id, input.userId)).limit(1);
    const [profile] = await tx.select({ id: userProfiles.id, enabled: userProfiles.enabled, bannedAt: userProfiles.bannedAt })
      .from(userProfiles).where(eq(userProfiles.id, input.userId)).for("update").limit(1);
    const denial = initialOwnerDenial({
      verifiedBetterAuthIdentity: identity?.emailVerified === true,
      activeProfile: profile?.enabled === true && profile.bannedAt === null,
      activeOwnerCount: ownerCount?.count ?? -1,
      separatelyApproved: input.separatelyApproved,
      evidenceRef: input.evidenceRef,
    });
    if (denial) throw new Error(`Initial owner bootstrap denied: ${denial}`);

    await tx.insert(userRoles).values({ userId: input.userId, role: "owner" });
    await tx.insert(securityAuditEvents).values({
      subjectUserId: input.userId,
      action: "initial_owner_bootstrapped",
      evidenceRef: input.evidenceRef,
    });
    return { userId: input.userId, role: "owner" as const };
  });
}
