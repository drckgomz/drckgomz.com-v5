const LEGACY_S3_HOST = "derickgomez-images.s3.us-east-1.amazonaws.com";
const BLOG_IMAGE_KEY = /^blog-images\/[A-Za-z0-9][A-Za-z0-9._-]{0,220}\.(?:jpe?g|png|webp|gif|avif)$/i;
const MEDIA_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type LegacyBlogImageReference = { url: string; key: string };

/** Accept only the reviewed, historical blog-image bucket and non-traversing object keys. */
export function parseLegacyBlogImageReference(value: string | null | undefined): LegacyBlogImageReference | null {
  if (!value || value.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    const key = url.pathname.slice(1);
    if (url.protocol !== "https:" || url.hostname !== LEGACY_S3_HOST || url.port || url.username || url.password ||
        url.search || url.hash || !BLOG_IMAGE_KEY.test(key) || key.split("/").some((segment) => segment === "." || segment === "..") ||
        url.pathname.includes("%") || url.pathname.includes("//")) return null;
    return { url: url.toString(), key };
  } catch {
    return null;
  }
}

/** Local owner previews never return the legacy S3 URL to the browser. */
export function localLegacyBlogImagePreviewUrl(mediaId: string, sourceUrl: string | null | undefined, env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === "production" || env.LOCAL_PG_INTEGRATION !== "1" || !MEDIA_ID.test(mediaId) || !parseLegacyBlogImageReference(sourceUrl)) return null;
  return `/api/dev/legacy-media-preview/${encodeURIComponent(mediaId)}`;
}

export function legacyBlogImageMediaId(value: string): string | null {
  return MEDIA_ID.test(value) ? value : null;
}
