/** Raster upload boundary; signature screening is not image decoding or malware scanning. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_MEDIA_BYTES = MAX_VIDEO_BYTES;
export const MAX_MULTIPART_BYTES = MAX_MEDIA_BYTES + 64 * 1024;

export class UploadInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export async function readUploadForm(request: Request, maxBytes = MAX_IMAGE_BYTES): Promise<FormData> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_MEDIA_BYTES) throw new UploadInputError("Invalid upload limit.", 500);
  const multipartLimit = maxBytes + 64 * 1024;
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > multipartLimit)) {
    throw new UploadInputError(`Upload request exceeds the ${Math.ceil(maxBytes / 1024 / 1024)} MiB limit.`, 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;") || !request.body) {
    throw new UploadInputError("Expected multipart/form-data.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > multipartLimit) {
        await reader.cancel();
        throw new UploadInputError(`Upload request exceeds the ${Math.ceil(maxBytes / 1024 / 1024)} MiB limit.`, 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch { throw new UploadInputError("Malformed multipart upload."); }
}

export function validateImageBytes(bytes: Uint8Array, contentType: string): string {
  if (!bytes.length) throw new UploadInputError("Image must not be empty.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new UploadInputError("Image exceeds 10 MiB.", 413);
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  let detected: string | undefined;
  if (bytes.length >= 24 && starts([137, 80, 78, 71, 13, 10, 26, 10])) detected = "image/png";
  if (bytes.length >= 4 && starts([255, 216, 255])) detected = "image/jpeg";
  if (bytes.length >= 13 && (starts([71, 73, 70, 56, 55, 97]) || starts([71, 73, 70, 56, 57, 97]))) detected = "image/gif";
  if (bytes.length >= 16 && starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((byte, i) => bytes[i + 8] === byte)) detected = "image/webp";
  if (!detected || contentType !== detected) throw new UploadInputError("Use a PNG, JPEG, GIF or WebP image with a matching content type.");
  return ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as Record<string, string>)[detected];
}

/** Validate raster signatures and common MP4/WebM container headers; never trusts filename extensions. */
export function validateMediaBytes(bytes: Uint8Array, contentType: string): { extension: string; kind: "image" | "video" } {
  if (!bytes.length) throw new UploadInputError("Media must not be empty.");
  if (bytes.length > MAX_MEDIA_BYTES) throw new UploadInputError("Media exceeds 50 MiB.", 413);
  if (contentType.startsWith("image/")) return { extension: validateImageBytes(bytes, contentType), kind: "image" };
  if (contentType === "video/mp4" && bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp") {
    return { extension: "mp4", kind: "video" };
  }
  if (contentType === "video/webm" && bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { extension: "webm", kind: "video" };
  }
  throw new UploadInputError("Use PNG, JPEG, GIF, WebP, MP4, or WebM media with a matching content type.");
}
