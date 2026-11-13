import DOMPurify from "dompurify";
import { isInstagramUrl } from "./render";

/** Client defense/preview; published API content is also sanitized on the server. */
export function sanitizeBlogPreview(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "referrerpolicy", "loading", "data-instgrm-permalink", "data-instgrm-version"],
    FORBID_TAGS: ["script", "form", "input", "object", "embed", "svg", "math"],
    FORBID_ATTR: [ "srcdoc", "id", "name"],
  });
  const document = new DOMParser().parseFromString(clean, "text/html");
  document.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
    const styles: Record<string, RegExp> = {
      "text-align": /^(left|right|center|justify)$/,
      "font-weight": /^(normal|bold|[1-9]00)$/,
      "font-style": /^(normal|italic)$/,
      "text-decoration": /^(none|underline|line-through)$/,
      "white-space": /^(normal|pre-wrap)$/,
      color: /^(#[0-9a-fA-F]{3,8}|rgb\([0-9, ]+\))$/,
    };
    const kept = Object.entries(styles).flatMap(([key, rule]) => {
      const value = node.style.getPropertyValue(key).trim();
      return rule.test(value) ? [`${key}:${value}`] : [];
    });
    node.removeAttribute("style");
    if (kept.length) node.setAttribute("style", kept.join(";"));
  });
  document.querySelectorAll("iframe").forEach((frame) => {
    try {
      const url = new URL(frame.src);
      if (url.protocol !== "https:" || !["www.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname) ||
          !/^\/embed\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.username || url.password) {
        frame.remove(); return;
      }
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("loading", "lazy");
      if (!frame.title) frame.title = "YouTube video";
    } catch { frame.remove(); }
  });
  document.querySelectorAll("[data-instgrm-permalink]").forEach((node) => {
    if (!isInstagramUrl(node.getAttribute("data-instgrm-permalink") ?? "")) node.remove();
  });
  document.querySelectorAll("pre,table").forEach((node) => node.setAttribute("tabindex", "0"));
  document.querySelectorAll("a").forEach((link) => link.setAttribute("rel", "noopener noreferrer"));
  return document.body.innerHTML;
}
