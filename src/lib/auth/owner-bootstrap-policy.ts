export type InitialOwnerGate = {
  verifiedBetterAuthIdentity: boolean;
  activeProfile: boolean;
  activeOwnerCount: number;
  separatelyApproved: boolean;
  evidenceRef: string | null;
};

export function initialOwnerDenial(gate: InitialOwnerGate): string | null {
  if (!gate.separatelyApproved) return "approval-required";
  if (!gate.verifiedBetterAuthIdentity) return "verified-identity-required";
  if (!gate.activeProfile) return "active-profile-required";
  if (!Number.isSafeInteger(gate.activeOwnerCount) || gate.activeOwnerCount !== 0) return "owner-already-exists-or-count-invalid";
  if (!gate.evidenceRef || gate.evidenceRef.trim().length < 8) return "audit-evidence-required";
  return null;
}
