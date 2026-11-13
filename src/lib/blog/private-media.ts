import type { AccessProfile, ContentAccess } from "@/lib/auth/policy";
import { canReadPost } from "@/lib/auth/policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const EXTENSION = /^(jpg|jpeg|png|webp|gif|avif)$/;

export function privateJournalPrefix(value = process.env.S3_PRIVATE_JOURNAL_PREFIX || "journal-private") {
  const prefix = value.replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.split("/").some((part) => !SEGMENT.test(part))) return null;
  return prefix;
}

export function privateJournalStorageConfig(env: Record<string, string | undefined> = process.env) {
  const bucket = env.S3_PRIVATE_JOURNAL_BUCKET;
  const region = env.AWS_REGION;
  const prefix = privateJournalPrefix(env.S3_PRIVATE_JOURNAL_PREFIX || "journal-private");
  if (!bucket || bucket === env.S3_BUCKET || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
      !region || !/^[a-z0-9-]+$/.test(region) || !prefix) return null;
  return { bucket, region, prefix };
}

export function makePrivateJournalKey(postId: string, mediaId: string, extension: string, prefix?: string) {
  const safePrefix = privateJournalPrefix(prefix);
  if (!safePrefix || !SEGMENT.test(postId) || !UUID.test(mediaId) || !EXTENSION.test(extension)) return null;
  return `${safePrefix}/${postId}/${mediaId}.${extension}`;
}

/** Only keys minted by this application are eligible for protected delivery. */
export function isPrivateJournalKey(key: string | null | undefined, postId: string, mediaId: string, prefix?: string) {
  if (!key) return false;
  const expected = privateJournalPrefix(prefix);
  if (!expected || key.includes("\\") || /[%?#\u0000-\u001f\u007f]/.test(key) || key.startsWith("/")) return false;
  const match = /^([A-Za-z0-9_/-]+)\/([A-Za-z0-9_-]{1,128})\/([0-9a-f-]+)\.([a-z]+)$/i.exec(key);
  return Boolean(match && match[1] === expected && match[2] === postId && match[3].toLowerCase() === mediaId.toLowerCase() &&
    UUID.test(mediaId) && EXTENSION.test(match[4].toLowerCase()) && !key.split("/").some((segment) => segment === "." || segment === ".."));
}

export function privateMediaUrl(mediaId: string) {
  return UUID.test(mediaId) ? `/api/private/journal-media/${mediaId}` : null;
}

export function isPrivateJournalObjectReference(value: string | null | undefined) {
  const prefix = privateJournalPrefix();
  return Boolean(value && prefix && (value === prefix || value.startsWith(`${prefix}/`)));
}

export function canReadProtectedMedia(post: ContentAccess, profile: AccessProfile | null) {
  if (post.status === "draft" && profile?.is_owner !== true) return false;
  return canReadPost(post, profile);
}

/** Private HTML may load only our authorization-checked image route. */
export function isPrivateMediaSource(value: string | undefined) {
  return typeof value === "string" && (
    /^\/api\/private\/journal-media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ||
    /^\/api\/dev\/legacy-media-preview\/[A-Za-z0-9_-]{1,128}$/.test(value)
  );
}

export function visibleJournalMediaUrl(input: { id: string; postId: string; url: string | null }, postStatus: string, normalize: (value: string | null) => string | null) {
  if (isPrivateJournalKey(input.url, input.postId, input.id)) return privateMediaUrl(input.id);
  if (isPrivateJournalObjectReference(input.url)) return null;
  // Historical/public URLs attached to private, draft, or archived posts are
  // quarantined from application responses. Their existing object URLs cannot
  // be revoked by this code and must be migrated at the storage layer.
  return postStatus === "public" ? normalize(input.url) : null;
}
