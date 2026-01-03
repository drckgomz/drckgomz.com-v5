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

export const normalizeMedia = (list: any[] = []): NormalizedMedia[] =>
  list.map((m) => ({
    id: m.id,
    type: m.type,
    url: m.url,
    caption:
      m.caption ??
      m.name ??
      m.label ??
      m.caption_text ??
      m.description ??
      null,
    title:
      m.title ??
      m.caption ??
      m.name ??
      m.label ??
      m.caption_text ??
      m.description ??
      null,
    post_id: m.post_id ?? null,
    idx: typeof m.idx === "number" ? m.idx : null,
    created_at: m.created_at ?? null,
  }));

export const sortMedia = <T extends { idx?: number | null; created_at?: any; id: any }>(list: T[]) =>
  [...list].sort((a, b) => {
    const ai = a.idx ?? Number.MAX_SAFE_INTEGER;
    const bi = b.idx ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (at !== bt) return at - bt;
    return String(a.id).localeCompare(String(b.id));
  });

export const getYouTubeVideoId = (url: string) =>
  (url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/)
    || url.match(/[?&]v=([0-9A-Za-z_-]{11})/))?.[1];
