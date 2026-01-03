// src/lib/blog/render.ts

/** Types used by BlogContent */
export type MediaItem = {
  id: string;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null; // for images or user-edited label
  title?: string | null;   // fetched (e.g., YouTube) title
};

const DBG = (label: string, payload?: any) =>
  console.debug(`[embed/render] ${label}`, payload);

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
function getYouTubeId(url: string) {
  const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  if (m) return m[1];
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    const maybe = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
    return maybe && /^[0-9A-Za-z_-]{6,}$/.test(maybe) ? maybe : null;
  } catch {
    return null;
  }
}

/** Build final HTML for a media item (matches v3 output structure). */
function buildEmbedHtml(item: MediaItem) {
  if (item.type === "youtube") {
    const id = getYouTubeId(item.url);
    if (!id) return "";
    return `
      <div class="flex justify-center my-0">
        <iframe
          width="100%"
          height="400"
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
    return `
      <div class="flex justify-center my-0">
        <blockquote class="instagram-media"
          data-instgrm-permalink="${item.url}"
          data-instgrm-version="14"
          style="background:#000; border:0; border-radius:3px; margin:0; max-width:540px; min-width:326px; padding:0; width:100%;">
        </blockquote>
      </div>
    `;
  }

  // image (caption optional like v3)
  return `
    <div class="flex flex-col items-center my-0">
      <img
        src="${item.url}"
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
  DBG("replacePlaceholders:start", { rawLen: rawContent?.length, mediaCount: media?.length });
  let html = normalize(rawContent || "");
  DBG("normalized", html.slice(0, 500));

  const items = Array.isArray(media) ? media : [];
  let replacedAny = false;

  // Defensive unwrap once more (if editor wrapped again)
  html = html.replace(/<span[^>]*?>\s*(\[MEDIA .*?\])\s*<\/span>/gi, "$1");

  for (const m of items) {
    const idEsc = escapeRegExp(m.id);
    const type = (m.type || "").toUpperCase();

    // Correct pattern (no over-escaping):
    // \[MEDIA\s+TYPE[\s\S]*?\(\s*id\s*\)\]
    const pattern = `\\[MEDIA\\s+${type}[\\s\\S]*?\\(\\s*${idEsc}\\s*\\)\\]`;
    const rx = new RegExp(pattern, "gi");

    const before = html;
    html = html.replace(rx, (_match) => {
      DBG("replacing", { type: m.type, id: m.id });
      return buildEmbedHtml(m);
    });
    if (before !== html) replacedAny = true;
  }

  DBG("replacedAny", replacedAny);
  DBG("finalHtmlPreview", html.slice(0, 500));
  return html;
}
