const DEFAULT_AUTH_REDIRECT = "/blog";
const REDIRECT_ORIGIN = "https://auth-redirect.invalid";

export function safeAuthRedirect(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) {
    return DEFAULT_AUTH_REDIRECT;
  }
  let decoded: string;
  let resolved: URL;
  try {
    decoded = decodeURIComponent(candidate);
    resolved = new URL(candidate, REDIRECT_ORIGIN);
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded) || resolved.origin !== REDIRECT_ORIGIN) {
    return DEFAULT_AUTH_REDIRECT;
  }
  return candidate;
}
