import "server-only";
import { headers } from "next/headers";
import { getBetterAuth } from "@/lib/auth/better-auth";
import { digestSessionToken, isSessionTokenDigest } from "@/lib/auth/session-token-digest-policy";
import { getBackendConfiguration } from "@/lib/backend-configuration";

/**
 * Return a SHA-256 digest of Better Auth's verified, database-backed session
 * token. The digest is still a bearer proof and must be treated as a secret;
 * it is never returned from a route or logged. Better Auth 1.7.16's get-session
 * API parses the session token field, while cookieCache is disabled in config.
 */
export async function getCurrentSessionTokenDigest(): Promise<string | null> {
  if (getBackendConfiguration().auth !== "better-auth") return null;
  try {
    const session = await getBetterAuth().api.getSession({ headers: await headers() });
    const token = session?.session?.token;
    if (typeof token !== "string" || token.length < 32) return null;
    return digestSessionToken(token);
  } catch {
    // Anonymous public reads can proceed with an empty RLS context. Private
    // reads remain denied because the database validates the current token.
    return null;
  }
}

export { isSessionTokenDigest };
