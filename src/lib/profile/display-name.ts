/** Resolve the public name from Better Auth's user.name, never app.user_profiles.username. */
export function resolveProfileDisplayName(authName: unknown, firstName: unknown, lastName: unknown): string {
  const auth = typeof authName === "string" ? authName.trim() : "";
  const fullName = [firstName, lastName]
    .map((part) => typeof part === "string" ? part.trim() : "")
    .filter(Boolean)
    .join(" ");
  if (auth) return auth;
  return fullName || "Member";
}
