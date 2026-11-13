import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { getOwnerLegacyMediaSourceById } from "@/lib/db/repositories/admin-posts";
import { legacyBlogImageMediaId, parseLegacyBlogImageReference } from "@/lib/blog/legacy-media-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};

function responseError(status: number) {
  return Response.json({ error: "Image preview unavailable." }, { status, headers: HEADERS });
}

function validImageSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (contentType === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (contentType === "image/gif") return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)));
  if (contentType === "image/avif") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" && String.fromCharCode(...bytes.slice(8, 12)).startsWith("avi");
  return false;
}

async function readLimited(body: ReadableStream<Uint8Array>, limit: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function GET(_request: Request, context: { params: Promise<{ mediaId: string }> }) {
  if (process.env.NODE_ENV === "production" || process.env.LOCAL_PG_INTEGRATION !== "1") return responseError(404);
  const denied = await requireAdminApi("posts:read");
  if (denied) return denied;
  const { mediaId: rawId } = await context.params;
  const mediaId = legacyBlogImageMediaId(rawId);
  if (!mediaId) return responseError(404);

  try {
    const media = await getOwnerLegacyMediaSourceById(mediaId);
    if (!media) return responseError(404);
    const source = parseLegacyBlogImageReference(media.url);
    if (!source) return responseError(404);

    const upstream = await fetch(source.url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: { "Accept": "image/jpeg,image/png,image/webp,image/gif,image/avif" },
    });
    if (!upstream.ok || !upstream.body) return responseError(502);
    const contentType = (upstream.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    const contentLength = Number(upstream.headers.get("content-length"));
    if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_BYTES) {
      await upstream.body.cancel().catch(() => {});
      return responseError(502);
    }
    const bytes = await readLimited(upstream.body, MAX_BYTES);
    if (!bytes || bytes.byteLength !== contentLength || !validImageSignature(bytes, contentType)) return responseError(502);
    return new Response(bytes, { status: 200, headers: {
      ...HEADERS,
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": "inline",
    } });
  } catch {
    return responseError(503);
  }
}
