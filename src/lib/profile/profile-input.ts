export type ProfileUpdateInput = {
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_color: string;
};

function boundedName(value: unknown, maxLength: number): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized || null;
}

/** Strict request boundary shared by the profile API and offline regression tests. */
export function parseProfileUpdateInput(value: unknown): ProfileUpdateInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["display_name", "first_name", "last_name", "avatar_color"].includes(key))) return null;
  const displayName = boundedName(body.display_name, 80);
  const firstName = boundedName(body.first_name, 80);
  const lastName = boundedName(body.last_name, 80);
  const avatarColor = body.avatar_color;
  if (typeof displayName !== "string" || !displayName || firstName === undefined || lastName === undefined ||
      typeof avatarColor !== "string" || !/^#[0-9a-f]{6}$/i.test(avatarColor)) return null;
  return {
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    avatar_color: avatarColor.toUpperCase(),
  };
}
