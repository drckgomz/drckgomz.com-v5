import { getYouTubeId, safeMediaUrl } from "./render";
// src/lib/blog/media.ts
export type NormalizedMedia = {
  id: string;
  type: "image" | "youtube" | "instagram" | string;
  url: string;
  caption?: string | null;
  title?: string | null;
  post_id?: string | null;
  idx?: number | null;
  created_at?: string | null;
};

export function normalizeMaybeS3Url(u: string | null) {
  if (!u) return u;
  u = u.trim();
  if (!safeMediaUrl(u)) return null;

  // already absolute
  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // ✅ IMPORTANT: local uploads in /public/uploads should remain local
  if (u.startsWith("/uploads/")) return u;
  if (u.startsWith("uploads/")) return `/${u}`;

  // If it's some other relative key, *then* map to S3 (optional behavior)
  const base = process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "";
  if (!base) return u;

  const key = u.replace(/^\/+/, "");
  const result = `${base.replace(/\/+$/, "")}/${key}`;
  return safeMediaUrl(result) ? result : null;
}

export const normalizeMedia = (list: unknown[] = []): NormalizedMedia[] =>
  list.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const m = item as Record<string, unknown>;
    if (typeof m.id !== "string" && typeof m.id !== "number") return [];
    const url = normalizeMaybeS3Url(typeof m.url === "string" ? m.url : null);
    if (!url) return [];
    const text = (...values: unknown[]) => values.find((value): value is string => typeof value === "string") ?? null;
    return [{
      id: String(m.id), type: typeof m.type === "string" ? m.type : "image", url,
      caption: text(m.caption, m.name, m.label, m.caption_text, m.description),
      title: text(m.title, m.caption, m.name, m.label, m.caption_text, m.description),
      post_id: text(m.post_id, m.postId),
      idx: typeof m.idx === "number" && Number.isFinite(m.idx) ? m.idx : null,
      created_at: text(m.created_at),
    }];
  });

export const sortMedia = <T extends { idx?: number | null; created_at?: string | null; id: string | number }>(list: T[]) =>
  [...list].sort((a, b) => {
    const ai = a.idx ?? Number.MAX_SAFE_INTEGER;
    const bi = b.idx ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (at !== bt) return at - bt;
    return String(a.id).localeCompare(String(b.id));
  });

export const getYouTubeVideoId = (url: string) => getYouTubeId(url) ?? undefined;
