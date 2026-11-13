export type OwnerState = { enabled: boolean; bannedAt: Date | null; hasOwnerRole: boolean };
export type AudienceTargetState = { exists: boolean; enabled?: boolean; bannedAt?: Date | null; emailVerified?: boolean };

export function ownerAuthorizationDenial(owner: OwnerState): "forbidden" | null {
  return owner.enabled && owner.bannedAt === null && owner.hasOwnerRole ? null : "forbidden";
}

export function audienceChangeDenial(
  actorId: string,
  targetId: string,
  target: AudienceTargetState,
  grant: boolean,
): "self-change" | "not-found" | "blocked" | null {
  if (actorId === targetId) return "self-change";
  if (!target.exists) return "not-found";
  if (grant && (target.enabled !== true || target.bannedAt !== null || target.emailVerified !== true)) return "blocked";
  return null;
}
