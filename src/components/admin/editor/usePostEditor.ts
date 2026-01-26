// src/components/admin/editor/usePostEditor.ts
"use client";

import * as React from "react";
import type { EditorHandle } from "./Editor";
import { normalizeMedia, sortMedia, type NormalizedMedia } from "./media";

type InitialPost = {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  media?: any[] | null;
};

export function usePostEditor(
  initialPost: InitialPost | null,
  opts: { mode: "edit"; slug: string }
) {
  const { slug } = opts;

  const [title, setTitle] = React.useState<string>(initialPost?.title || "");
  const [postSlug, setPostSlug] = React.useState<string>(initialPost?.slug || slug || "");
  const [content, setContent] = React.useState<string>(initialPost?.content || "");
  const [mediaList, setMediaList] = React.useState<NormalizedMedia[]>(
    sortMedia(normalizeMedia(initialPost?.media || []))
  );

  const editorRef = React.useRef<EditorHandle | null>(null);

  const [postId, setPostId] = React.useState<string>(() =>
    initialPost?.id ? String(initialPost.id) : ""
  );

  React.useEffect(() => {
    if (initialPost?.id) setPostId(String(initialPost.id));
  }, [initialPost?.id]);

  // Hydrate media from v5 Next API
  React.useEffect(() => {
    if (!slug) return;

    let aborted = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/admin/posts/${encodeURIComponent(slug)}/media`,
          { method: "GET", cache: "no-store" }
        );
        if (!res.ok) return;

        const json = await res.json().catch(() => ({}));
        const raw = Array.isArray(json?.media)
          ? json.media
          : Array.isArray(json)
          ? json
          : [];

        const full = sortMedia(normalizeMedia(raw));
        if (!aborted) setMediaList(full);
      } catch (e) {
        console.error("[usePostEditor] hydrate media error", e);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [slug]);

  const insertPlaceholder = (m: {
    id: string;
    type: string;
    caption?: string | null;
    title?: string | null;
  }) => {
    editorRef.current?.insertMediaPlaceholder({
      id: m.id,
      type: m.type as any,
      caption: m.caption ?? null,
      title: m.title ?? null,
    });
    editorRef.current?.focus();
  };

  const updateCaptionInEditor = (
    m: { id: string; type: string },
    newCaption: string | null
  ) => {
    editorRef.current?.updateMediaCaption({
      id: m.id,
      type: m.type as any,
      caption: newCaption,
      title: undefined,
    });
  };

  const submitPayload = () => ({
    title,
    slug: postSlug,
    content,
  });

  return {
    title,
    setTitle,
    slug: postSlug,
    setSlug: setPostSlug,
    content,
    setContent,
    mediaList,
    setMediaList,
    editorRef,
    postId,
    setPostId,
    insertPlaceholder,
    updateCaptionInEditor,
    submitPayload,
  };
}
