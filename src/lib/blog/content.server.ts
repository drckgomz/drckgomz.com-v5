import "server-only";
import sanitizeHtml from "sanitize-html";
import { projectHtmlOptions } from "@/lib/content/projectHtml";
import { replacePlaceholders, type MediaItem } from "./render";
import { isPrivateMediaSource } from "./private-media";

/** Same HTML restrictions as projects, plus nonexecutable Instagram metadata. */
export function sanitizeBlogHtml(value: string | null | undefined): string {
  const options = projectHtmlOptions();
  return sanitizeHtml(value ?? "", {
    ...options,
    allowedTags: [...(options.allowedTags as string[]), "details", "summary"],
    allowedAttributes: { ...options.allowedAttributes, blockquote: ["class", "data-instgrm-permalink", "data-instgrm-version"], pre: ["tabindex"], table: ["tabindex"] },
    transformTags: { ...options.transformTags, pre: (tagName, attribs) => ({ tagName, attribs: { ...attribs, tabindex: "0" } }), table: (tagName, attribs) => ({ tagName, attribs: { ...attribs, tabindex: "0" } }) },
    allowedClasses: { ...options.allowedClasses, blockquote: ["instagram-media"] },
  });
}

export function prepareBlogContent(content: string | null, media: MediaItem[]): string {
  return sanitizeBlogHtml(replacePlaceholders(sanitizeBlogHtml(content), media));
}

/** Private posts never cause a browser request to an uncontrolled media host. */
export function preparePrivateBlogContent(content: string | null, media: MediaItem[]): string {
  const rendered = prepareBlogContent(content, media);
  const options = projectHtmlOptions();
  const previousFilter = options.exclusiveFilter;
  return sanitizeHtml(rendered, {
    ...options,
    allowedTags: [...(options.allowedTags as string[]), "details", "summary"],
    exclusiveFilter: (frame) => {
      if (previousFilter?.(frame)) return true;
      if (["video", "audio", "source", "track", "iframe"].includes(frame.tag)) return true;
      if (frame.tag === "img") return !isPrivateMediaSource(frame.attribs.src);
      if (frame.tag === "blockquote" && frame.attribs.class?.split(/\s+/).includes("instagram-media")) return true;
      return false;
    },
  });
}
