/** Baseline app profile for OAuth self-registration; privileged grants are separate owner actions. */
export function newPublicMemberProfile(userId: string) {
  return {
    id: userId,
    username: `member-${userId}`,
    enabled: true,
    firstName: null,
  } as const;
}
