// src/components/blog/admin/posts/ManagePostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import type { AdminPost, PostStatus } from "@/lib/admin/types";


export default function ManagePostForm({
  initialPost,
  mode,
}: {
  initialPost: AdminPost | null;
  mode: "new" | "edit";
}) {
  const router = useRouter();

  const [title, setTitle] = React.useState(initialPost?.title ?? "");
  const [slug, setSlug] = React.useState(initialPost?.slug ?? "");
  const [excerpt, setExcerpt] = React.useState(initialPost?.excerpt ?? "");
  const [content, setContent] = React.useState(initialPost?.content ?? "");
  const [status, setStatus] = React.useState<PostStatus>(
  ((initialPost?.status ?? "draft") as PostStatus)
);


  const [thumbnailUrl, setThumbnailUrl] = React.useState(
    initialPost?.thumbnail_url ?? ""
  );

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSave() {
    setErr(null);
    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt || null,
        content: content || null,
        status,
        thumbnail_url: thumbnailUrl || null,
      };

      if (!payload.title || !payload.slug) {
        throw new Error("Title and slug are required.");
      }

      const url =
        mode === "new"
          ? "/api/admin/posts"
          : `/api/admin/posts/${encodeURIComponent(initialPost?.slug || payload.slug)}`;

      const method = mode === "new" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          // NOTE: if your API still requires Authorization, you must include it here,
          // or switch the API to your real requireAdminApi that reads Clerk cookies.
          // authorization: `Bearer dev`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      const saved: AdminPost | undefined = json?.post;
      const nextSlug = saved?.slug || payload.slug;

      router.push(`/admin/posts/${encodeURIComponent(nextSlug)}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Slug</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Excerpt</label>
        <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Thumbnail URL</label>
        <Input
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="draft">draft</option>
            <option value="private">private</option>
            <option value="public">public</option>
            <option value="archived">archived</option>
          </select>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Content</label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} />
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : mode === "new" ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
}
