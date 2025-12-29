"use client";

import * as React from "react";

export function usePostEditor(initialPost: any, mode: "create" | "edit") {
  const [title, setTitle] = React.useState(initialPost?.title ?? "");
  const [slug, setSlug] = React.useState(initialPost?.slug ?? "");
  const [content, setContent] = React.useState(initialPost?.content ?? "");

  React.useEffect(() => {
    if (mode === "edit" && initialPost) {
      setTitle(initialPost.title ?? "");
      setSlug(initialPost.slug ?? "");
      setContent(initialPost.content ?? "");
    }
  }, [mode, initialPost]);

  const submitPayload = () => ({ title, slug, content });

  return {
    title,
    setTitle,
    slug,
    setSlug,
    content,
    setContent,
    submitPayload,
  };
}
