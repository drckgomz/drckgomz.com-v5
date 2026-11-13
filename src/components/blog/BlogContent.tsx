"use client";

import * as React from "react";
import { sanitizeBlogPreview } from "@/lib/blog/preview";
import { replacePlaceholders, type MediaItem } from "@/lib/blog/render";

const subscribe = () => () => {};


export default function BlogContent({ content, media }: { content: string; media: MediaItem[] }) {
  const hydrated = React.useSyncExternalStore(subscribe, () => true, () => false);
  const sanitizedHtml = React.useMemo(() => hydrated
    ? sanitizeBlogPreview(replacePlaceholders(content || "", media || [])) : "", [content, media, hydrated]);
  const [embedsAllowed, setEmbedsAllowed] = React.useState(false);
  const [embedError, setEmbedError] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const hasInstagram = sanitizedHtml.includes('class="instagram-media"');

  React.useEffect(() => {
    if (!embedsAllowed || !hasInstagram) return;
    let active = true;
    const process = () => {
      if (active) (window as Window & { instgrm?: { Embeds?: { process: () => void } } }).instgrm?.Embeds?.process();
    };
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.instagram.com/embed.js"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.instagram.com/embed.js";
      script.async = true;
      document.body.appendChild(script);
    }
    const onError = () => { if (active) setEmbedError(true); };
    script.addEventListener("load", process);
    script.addEventListener("error", onError);
    process();
    return () => { active = false; script.removeEventListener("load", process); script.removeEventListener("error", onError); };
  }, [embedsAllowed, hasInstagram, sanitizedHtml]);

  return (
    <div className="blog-content-shell">
      {hasInstagram && !embedsAllowed && <div className="blog-embed-notice">
        <p>Instagram embeds contact a third party. Links work without loading them.</p>
        <button type="button" onClick={() => setEmbedsAllowed(true)}>Load Instagram embeds</button>
      </div>}
      {embedError && <p role="status">Instagram could not load. Use the post link instead.</p>}
      <div ref={ref} className="blog-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
    </div>
  );
}
