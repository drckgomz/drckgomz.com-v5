import "server-only";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

const ROOT = resolve(process.cwd(), ".artifacts/phase7/private-media");
const KEY = /^journal-private\/([A-Za-z0-9_-]{1,128})\/([0-9a-f-]{36})\.(jpg|png|gif|webp|mp4|webm)$/i;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", webm: "video/webm",
};

function objectPath(key: string): string | null {
  if (!isLocalPostgresIntegrationEnabled(process.env)) return null;
  const match = KEY.exec(key);
  if (!match) return null;
  const target = resolve(ROOT, ...key.split("/"));
  return target.startsWith(`${ROOT}/`) ? target : null;
}

export async function storeLocalPrivateMedia(key: string, bytes: Uint8Array) {
  const target = objectPath(key);
  if (!target) throw new Error("Local media store is unavailable.");
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  catch (error) { await handle.close(); await unlink(target).catch(() => {}); throw error; }
  await handle.close();
}

export async function readLocalPrivateMedia(key: string) {
  const target = objectPath(key);
  if (!target) return null;
  try {
    const metadata = await stat(target);
    if (!metadata.isFile() || metadata.size < 1 || metadata.size > 50 * 1024 * 1024) return null;
    const bytes = await readFile(target);
    const extension = KEY.exec(key)?.[3]?.toLowerCase();
    if (!extension || bytes.byteLength !== metadata.size) return null;
    return { bytes, mimeType: MIME_BY_EXTENSION[extension], size: metadata.size };
  } catch { return null; }
}

export async function removeLocalPrivateMedia(key: string) {
  const target = objectPath(key);
  if (!target) return false;
  try { await unlink(target); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    return false;
  }
}

export function localPrivateMediaKey(postId: string, mediaId: string, extension: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(postId) || !/^[0-9a-f-]{36}$/i.test(mediaId) || !/^(jpg|png|gif|webp|mp4|webm)$/.test(extension)) return null;
  return `journal-private/${postId}/${mediaId}.${extension}`;
}

export function localPrivateMediaType(key: string) {
  const extension = KEY.exec(key)?.[3]?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
}
