// src/lib/blog/render.ts

/** Types used by BlogContent */
export type MediaItem = {
  id: string;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null; // for images or user-edited label
  title?: string | null;   // fetched (e.g., YouTube) title
};

/** Escape html for attributes/text nodes. */
function escapeHtml(text: string) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape for use inside a RegExp. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize editor quirks so regex matches reliably. */
export function normalize(raw: string) {
  if (!raw) return "";
  let out = raw
    // decode [ and ] that some editors encode
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&lbrack;/g, "[")
    .replace(/&rbrack;/g, "]")
    // drop ZWSP & NBSP
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ");

  // unwrap ANY span(s) that only wrap the placeholder (common from editors)
  out = out.replace(/(?:<span[^>]*>)+\s*(\[MEDIA[\s\S]*?\])\s*(?:<\/span>)+/gi, "$1");
  return out;
}

/** v3-style YouTube ID extraction (robust for typical URLs). */
export function safeMediaUrl(value: string): boolean {
  if (!value || /[\u0000-\u001f\u007f\\"<>]/.test(value)) return false;
  try { return ["http:", "https:"].includes(new URL(value, "https://relative.invalid").protocol); }
  catch { return false; }
}

export function getYouTubeId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
      id = url.searchParams.get("v") || (/^\/(embed|shorts)\//.test(url.pathname) ? url.pathname.split("/")[2] : null);
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function isInstagramUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["www.instagram.com", "instagram.com"].includes(url.hostname) &&
      !url.username && !url.password && /^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
  } catch { return false; }
}

/** Build final HTML for a media item (matches v3 output structure). */
function buildEmbedHtml(item: MediaItem) {
  if (!safeMediaUrl(item.url)) return "";
  if (item.type === "youtube") {
    const id = getYouTubeId(item.url);
    if (!id) return "";
    return `
      <div class="flex justify-center my-0">
        <iframe
          width="100%"
          height="400"
          title="${escapeHtml(item.title || item.caption || "YouTube video")}"
          loading="lazy"
          referrerpolicy="no-referrer"
          src="https://www.youtube.com/embed/${id}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          class="rounded-lg max-w-3xl"
        ></iframe>
      </div>
    `;
  }

  if (item.type === "instagram") {
    if (!isInstagramUrl(item.url)) return "";
    return `
      <div class="flex justify-center my-0">
        <blockquote class="instagram-media"
          data-instgrm-permalink="${escapeHtml(item.url)}"
          data-instgrm-version="14"
          >
          <a href="${escapeHtml(item.url)}" rel="noopener noreferrer">View Instagram post</a>
        </blockquote>
      </div>
    `;
  }

  // image (caption optional like v3)
  return `
    <div class="flex flex-col items-center my-0">
      <img
        src="${escapeHtml(item.url)}"
        alt="${escapeHtml(item.caption || "Image")}"
        class="rounded-lg max-w-sm"
        loading="lazy"
      />
      <p class="text-sm text-gray-400 mt-2 text-center">${escapeHtml(item.caption || "")}</p>
    </div>
  `;
}

/**
 * v3-compatible placeholder replacement:
 * For each media item, match: [MEDIA {TYPE} ... (id)]
 * - case-insensitive
 * - tolerates any text between ":" and "(id)"
 * - tolerates whitespace around id
 */
export function replacePlaceholders(rawContent: string, media: MediaItem[]) {
  let html = normalize(rawContent || "");

  const items = Array.isArray(media) ? media : [];

  // Defensive unwrap once more (if editor wrapped again)
  html = html.replace(/<span[^>]*?>\s*(\[MEDIA .*?\])\s*<\/span>/gi, "$1");

  for (const m of items) {
    const idEsc = escapeRegExp(m.id);
    const type = (m.type || "").toUpperCase();

    // Correct pattern (no over-escaping):
    // \[MEDIA\s+TYPE[\s\S]*?\(\s*id\s*\)\]
    const pattern = `\\[MEDIA\\s+${type}[\\s\\S]*?\\(\\s*${idEsc}\\s*\\)\\]`;
    const rx = new RegExp(pattern, "gi");

    html = html.replace(rx, () => {
      return buildEmbedHtml(m);
    });
  }

  return html;
}
