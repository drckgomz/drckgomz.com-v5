import "server-only";
import sanitizeHtml from "sanitize-html";

/** URLs outside rich HTML also cross a server trust boundary (links, covers, media). */
export function safeProjectUrl(value: string | null | undefined, allowMailto = false): string | null {
  if (!value) return null;
  const url = value.trim();
  if (!url || /[\u0000-\u001f\u007f\\]/.test(url)) return null;
  try {
    const parsed = new URL(url, "https://relative.invalid");
    if (!["http:", "https:", ...(allowMailto ? ["mailto:"] : [])].includes(parsed.protocol)) return null;
    return url.startsWith("//") ? `https:${url}` : url;
  } catch {
    return null;
  }
}

function isVideoEmbed(src: string | undefined): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" &&
      ["www.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname) &&
      /^\/embed\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Sanitize on every server read, so legacy HTML is safe without a backfill. */
export function projectHtmlOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "video", "audio", "source", "track", "iframe"],
    allowedAttributes: {
      "*": ["class", "title", "style"],
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "width", "height", "loading"],
      video: ["src", "poster", "controls", "playsinline", "preload", "width", "height"],
      audio: ["src", "controls", "preload"],
      source: ["src", "type"], track: ["src", "kind", "srclang", "label", "default"],
      iframe: ["src", "title", "width", "height", "allowfullscreen", "loading", "sandbox", "referrerpolicy"],
      td: ["colspan", "rowspan"], th: ["colspan", "rowspan", "scope"],
      ol: ["start"], li: ["value"],
    },
    allowedClasses: { "*": ["text-left", "text-center", "text-right", "rounded-lg", "max-w-full", "mx-auto", "flex", "justify-center", "my-0", "my-4", "mb-4", "flex-col", "items-center", "max-w-sm", "max-w-3xl", "text-sm", "text-gray-400", "mt-2", "media-placeholder", "inline-flex", "rounded-md", "font-semibold", "tracking-wide", "text-cyan-300", "bg-cyan-500/10", "px-1.5", "py-0.5", "ring-1", "ring-cyan-400/30"] },
    allowedStyles: { "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/], "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline|line-through)$/], "white-space": [/^(normal|pre-wrap)$/],
      color: [/^#[0-9a-fA-F]{3,8}$/],
    } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"], video: ["http", "https"], audio: ["http", "https"], source: ["http", "https"], track: ["http", "https"], iframe: ["https"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "poster", "cite"],
    allowProtocolRelative: true,
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    allowIframeRelativeUrls: false,
    transformTags: {
      a: (_tag, attributes) => ({ tagName: "a", attribs: { ...attributes, rel: "noopener noreferrer" } }),
      iframe: (_tag, attributes) => ({ tagName: "iframe", attribs: {
        ...attributes, src: safeProjectUrl(attributes.src) ?? "", sandbox: "allow-scripts allow-same-origin allow-presentation",
        referrerpolicy: "no-referrer", loading: "lazy",
      } }),
    },
    exclusiveFilter: (frame) => frame.tag === "iframe" && !isVideoEmbed(frame.attribs.src),
  };
}

export function sanitizeProjectHtml(value: string | null | undefined): string {
  return sanitizeHtml(value ?? "", projectHtmlOptions());
}
