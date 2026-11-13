import { safeProjectUrl } from "@/lib/content/projectHtml";
import { getYouTubeId, isInstagramUrl } from "@/lib/blog/render";

export type ProjectMediaFields = {
  type?: string; url?: string; caption?: string | null; idx?: number | null;
  meta?: Record<string, unknown> | null;
};
/** One boundary for batch creation and individual edits. Existing embed fields are checked together. */
export function validateProjectMedia(input: unknown, existing?: { type: string; url: string }): { fields: ProjectMediaFields; error?: string } {
  const fields: ProjectMediaFields = {};
  const fail = () => ({ fields, error: "Invalid project media fields." });
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail();
  const row = input as Record<string, unknown>;
  if (!Object.keys(row).length || Object.keys(row).some(key => !["type", "url", "caption", "idx", "meta"].includes(key))) return fail();
  if ("type" in row) {
    if (typeof row.type !== "string" || !["image", "video", "file", "youtube", "instagram"].includes(row.type)) return fail();
    fields.type = row.type;
  }
  if ("url" in row) {
    if (typeof row.url !== "string" || row.url.length > 2048) return fail();
    const url = safeProjectUrl(row.url);
    if (!url) return fail();
    fields.url = url;
  }
  if ("caption" in row) {
    if (row.caption !== null && (typeof row.caption !== "string" || row.caption.length > 2000)) return fail();
    fields.caption = row.caption as string | null;
  }
  if ("idx" in row) {
    if (row.idx !== null && (typeof row.idx !== "number" || !Number.isSafeInteger(row.idx) || row.idx < 0)) return fail();
    fields.idx = row.idx as number | null;
  }
  if ("meta" in row) {
    if (row.meta !== null && (typeof row.meta !== "object" || Array.isArray(row.meta) || JSON.stringify(row.meta).length > 10000)) return fail();
    fields.meta = row.meta as Record<string, unknown> | null;
  }
  // Caption/order-only edits need not repair unrelated legacy URLs.
  if (!existing || "type" in fields || "url" in fields) {
    const type = fields.type ?? existing?.type ?? "image";
    const url = fields.url ?? existing?.url;
    if (!url || (type === "youtube" && !getYouTubeId(url)) || (type === "instagram" && !isInstagramUrl(url))) return fail();
  }
  return { fields };
}
