import { createHash } from "node:crypto";

/** SHA-256 transport representation; still a sensitive, replayable bearer proof. */
export function digestSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isSessionTokenDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
