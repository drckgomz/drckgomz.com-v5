// src/components/admin/editor/usePostEditor.ts
"use client";

import { createMediaHydration } from "@/lib/cms/mediaHydration";
import * as React from "react";
import type { EditorHandle } from "./Editor";
import { normalizeMedia, sortMedia, type NormalizedMedia } from "./media";

type InitialPost = {
  id?: string | number | null;
  title?: string | null;
  slug?: string | null;
  content?: string | null;
  media?: unknown[] | null;
};

export function usePostEditor(
  initialPost: InitialPost | null,
  opts: { mode: "edit"; slug: string }
) {
  const { slug } = opts;

  const [title, setTitle] = React.useState<string>(initialPost?.title || "");
  const [postSlug, setPostSlug] = React.useState<string>(initialPost?.slug || slug || "");
  const [content, setContent] = React.useState<string>(initialPost?.content || "");
  const [mediaList, setMediaListState] = React.useState<NormalizedMedia[]>(
    () => sortMedia(normalizeMedia(initialPost?.media || []))
  );

  const editorRef = React.useRef<EditorHandle | null>(null);

  const [postId, setPostId] = React.useState<string>(() =>
    initialPost?.id ? String(initialPost.id) : ""
  );

  React.useEffect(() => {
    if (initialPost?.id) setPostId(String(initialPost.id));
  }, [initialPost?.id]);

  const hydration = React.useRef<ReturnType<typeof createMediaHydration> | null>(null);
  if (hydration.current === null) { hydration.current = createMediaHydration(); }
  const [mediaError, setMediaError] = React.useState("");
  const setMediaList = React.useCallback<React.Dispatch<React.SetStateAction<NormalizedMedia[]>>>((update) => {
    hydration.current?.edited();
    setMediaListState(update);
  }, []);
  React.useEffect(() => {
    if (!slug) return;
    const source = hydration.current!;
    let active = true;
    void source.load(slug, setMediaListState).catch(() => {
      if (active) setMediaError("Unable to refresh media. Existing edits were retained.");
    });
    return () => { active = false; source.cancel(); };
  }, [slug]);

  const insertPlaceholder = (m: {
    id: string;
    type: string;
    caption?: string | null;
    title?: string | null;
  }) => {
    if (!["image", "youtube", "instagram"].includes(m.type)) return;
    editorRef.current?.insertMediaPlaceholder({
      id: m.id,
      type: m.type as "image" | "youtube" | "instagram",
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
      type: m.type as "image" | "youtube" | "instagram",
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
    mediaError,
    setMediaList,
    editorRef,
    postId,
    setPostId,
    insertPlaceholder,
    updateCaptionInEditor,
    submitPayload,
  };
}
