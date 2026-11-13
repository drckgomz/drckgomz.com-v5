/** Strict Origin validation for cookie-authenticated mutation endpoints. */
export function isSameOriginRequest(input: { headers: Pick<Headers, "get">; url: string }): boolean {
  const originHeader = input.headers.get("origin");
  const forwardedHost = input.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = (forwardedHost || input.headers.get("host"))?.toLowerCase();
  const forwardedProto = input.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();
  if (!originHeader || !host) return false;
  try {
    const origin = new URL(originHeader);
    const request = new URL(input.url);
    const protocol = forwardedProto ? `${forwardedProto}:` : request.protocol;
    return origin.host.toLowerCase() === host && origin.protocol === protocol && !origin.username && !origin.password;
  } catch {
    return false;
  }
}
