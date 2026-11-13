import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { canReadProtectedMedia, isPrivateJournalKey, privateJournalStorageConfig } from "@/lib/blog/private-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};
type ProtectedMedia = { id: string; postId: string; url: string | null; status: string; deleted_at?: unknown; deletion_date?: unknown; is_deleted?: unknown };

async function findMedia(id: string): Promise<ProtectedMedia | null> {
  const [{ eq }, { withCurrentContentSession }, { media, posts }] = await Promise.all([
    import("drizzle-orm"), import("@/lib/db/content-session"), import("@/lib/db/schema"),
  ]);
  const row = await withCurrentContentSession(async (tx) => {
    const [result] = await tx.select({ id: media.id, postId: media.postId, url: media.url,
      publicationState: posts.publicationState, visibility: posts.visibility,
      deletedAt: posts.deletedAt, deletionDate: posts.deletionDate,
    }).from(media).innerJoin(posts, eq(media.postId, posts.id)).where(eq(media.id, id)).limit(1);
    return result;
  });
  if (!row) return null;
  const status = row.publicationState === "published" ? row.visibility : row.publicationState;
  return { id: row.id, postId: row.postId, url: row.url, status, deleted_at: row.deletedAt, deletion_date: row.deletionDate };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await context.params;
  if (!UUID.test(mediaId)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
  try {
    const viewer = await getViewer();
    const item = await findMedia(mediaId);
    if (!item || !isPrivateJournalKey(item.url, item.postId, item.id) ||
        !canReadProtectedMedia(item, viewer.profile)) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: PRIVATE_HEADERS });
    }
    const config = privateJournalStorageConfig();
    if (!config) return NextResponse.json({ error: "Private media is unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
    const s3 = new S3Client({ region: config.region });
    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: item.url! }));
      const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
      if (!result.Body || !result.ContentType || !allowedTypes.has(result.ContentType.toLowerCase()) ||
          typeof result.ContentLength !== "number" || result.ContentLength < 0 || result.ContentLength > 30 * 1024 * 1024) {
        return NextResponse.json({ error: "Private media is unavailable." }, { status: 502, headers: PRIVATE_HEADERS });
      }
      const bytes = await result.Body.transformToByteArray();
      if (bytes.byteLength !== result.ContentLength) return NextResponse.json({ error: "Private media is unavailable." }, { status: 502, headers: PRIVATE_HEADERS });
      const responseBuffer = new Uint8Array(bytes.byteLength);
      responseBuffer.set(bytes);
      return new Response(responseBuffer.buffer, { status: 200, headers: { ...PRIVATE_HEADERS, "Content-Type": result.ContentType.toLowerCase(), "Content-Length": String(bytes.byteLength), "Content-Disposition": "inline" } });
    } finally {
      s3.destroy();
    }
  } catch {
    return NextResponse.json({ error: "Private media is unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
