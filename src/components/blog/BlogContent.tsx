// frontend/src/features/blog/components/BlogContent.tsx

"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { replacePlaceholders, type MediaItem } from "@/features/blog/embed/render";

const DBG = (label: string, payload?: any) =>
  console.debug(`[BlogContent] ${label}`, payload);

export default function BlogContent({
  content,
  media,
}: {
  content: string;
  media: MediaItem[];
}) {
  DBG("props", { contentLen: content?.length, mediaCount: media?.length });

  // 1) build the HTML with embeds swapped in (v3 behavior)
  const unsafeHtml: string = React.useMemo(() => {
    const out = replacePlaceholders(content || "", media || []);
    DBG("unsafeHtmlPreview", out.slice(0, 500));
    return out;
  }, [content, media]);

  // 2) sanitize it
  const sanitizedHtml: string = React.useMemo(() => {
    const s = DOMPurify.sanitize(unsafeHtml, {
      ADD_TAGS: ["iframe", "blockquote"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "referrerpolicy",
        "data-instgrm-permalink",
        "data-instgrm-version",
        "title",
        "loading",
        "src",
        "class",
        "style",
      ],
      FORBID_TAGS: ["script"],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:https?:)?\/\/)|data:image\/|mailto:)/i,
    });
    DBG("sanitizedHtmlPreview", s.slice(0, 500));
    return s;
  }, [unsafeHtml]);

  // 3) ping Instagram after the sanitized HTML is on the page (prevents race)
  React.useEffect(() => {
    const hasScript = !!document.querySelector(
      'script[src="https://www.instagram.com/embed.js"]'
    );
    if (!hasScript) {
      const s = document.createElement("script");
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      document.body.appendChild(s);
      DBG("instagram script injected");
    } else {
      DBG("instagram script present");
    }
    const t = setTimeout(() => {
      const ok = (window as any).instgrm?.Embeds?.process?.();
      DBG("instgrm.process invoked", { ok: !!ok });
    }, 400);
    return () => clearTimeout(t);
  }, [sanitizedHtml]);

  return (
    <div
      className="text-white text-lg space-y-0 whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
