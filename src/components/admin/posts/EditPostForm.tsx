// src/components/admin/posts/EditPostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import Editor from "@/components/admin/editor/Editor";
import MediaList from "@/components/admin/editor/MediaList";
import { usePostEditor } from "@/components/admin/editor/usePostEditor";
import { useSlugInput } from "@/components/admin/editor/useSlug";
import { useMediaOrder } from "@/components/admin/editor/useMediaOrder";

import type { AdminPost, PostStatus } from "@/lib/admin/types";

function detectMediaType(url: string): "youtube" | "instagram" | "link" {
  const u = url.toLowerCase();
  if (u.includes("youtu.be") || u.includes("youtube.com")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  return "link";
}

export default function EditPostForm({ initialPost }: { initialPost: AdminPost }) {
  const router = useRouter();

  const editor = usePostEditor(
    {
      id: initialPost.id,
      title: initialPost.title ?? "",
      slug: initialPost.slug ?? "",
      content: initialPost.content ?? "",
      media: (initialPost as any)?.media ?? [],
    },
    { mode: "edit", slug: initialPost.slug }
  );

  const [excerpt, setExcerpt] = React.useState(initialPost.excerpt ?? "");
  const [status, setStatus] = React.useState<PostStatus>(
    (initialPost.status ?? "draft") as PostStatus
  );
  const [thumbnailUrl, setThumbnailUrl] = React.useState(initialPost.thumbnail_url ?? "");

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const slugHandlers = useSlugInput(editor.slug, editor.setSlug);
  const { queueSave } = useMediaOrder({
    slug: initialPost.slug,
    notify: (m) => console.warn(m),
  });

  async function onSave() {
    setErr(null);
    setSaving(true);

    try {
      const payload = {
        title: editor.title.trim(),
        slug: editor.slug.trim(),
        excerpt: excerpt.trim() || null,
        content: editor.content || null,
        status,
        thumbnail_url: thumbnailUrl.trim() || null,
      };

      if (!payload.title || !payload.slug) {
        throw new Error("Title and slug are required.");
      }

      const res = await fetch(`/api/admin/posts/${encodeURIComponent(initialPost.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      const saved: AdminPost | undefined = json?.post;
      const nextSlug = saved?.slug || payload.slug;

      if (nextSlug !== initialPost.slug) {
        router.push(`/admin/posts/${encodeURIComponent(nextSlug)}`);
        return;
      }

      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveMedia(mediaId: string) {
    if (!confirm("Remove this media item?")) return;

    const res = await fetch(`/api/admin/media/${encodeURIComponent(mediaId)}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert(txt || "Failed to remove media");
      return;
    }

    editor.setMediaList((prev) => prev.filter((m) => m.id !== mediaId));
    editor.editorRef.current?.removeMediaPlaceholders(mediaId);
  }

  async function onAddLink(url: string, cb?: (id: string) => void) {
    const clean = (url ?? "").trim();
    if (!clean) return;

    if (!editor.title.trim() || !editor.slug.trim()) {
      alert("Title and slug are required before attaching media.");
      return;
    }

    const res = await fetch(
      `/api/admin/posts/${encodeURIComponent(initialPost.slug)}/media/link`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: detectMediaType(clean),
          url: clean,
        }),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "Failed to add link");
      return;
    }

    const media = json?.media ?? json;
    if (!media?.id) {
      alert("Media created, but no id returned.");
      return;
    }

    const normalized = {
      id: String(media.id),
      type: media.type ?? detectMediaType(clean),
      url: media.url ?? clean,
      caption: media.caption ?? media.name ?? media.label ?? null,
      title: media.title ?? media.caption ?? media.name ?? null,
      idx: typeof media.idx === "number" ? media.idx : null,
      created_at: media.created_at ?? null,
      ...media,
    };

    editor.setMediaList((prev) => [...prev, normalized as any]);
    cb?.(String(media.id));
  }

  async function onUpload(file: File) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (!editor.title.trim() || !editor.slug.trim()) {
      alert("Title and slug are required before attaching media.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(
      `/api/admin/posts/${encodeURIComponent(initialPost.slug)}/media/upload`,
      { method: "POST", body: fd }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "Failed to upload image");
      return;
    }

    const media = json?.media ?? json;
    if (!media?.id) {
      alert("Upload succeeded, but no media id returned.");
      return;
    }

    const normalized = {
      id: String(media.id),
      type: media.type ?? "image",
      url: media.url,
      caption: media.caption ?? media.name ?? media.label ?? null,
      title: media.title ?? media.caption ?? media.name ?? null,
      idx: typeof media.idx === "number" ? media.idx : null,
      created_at: media.created_at ?? null,
      ...media,
    };

    editor.setMediaList((prev) => [...prev, normalized as any]);
  }

  async function onSetThumbnail(m: { id: string; url: string }) {
    setThumbnailUrl(m.url);

    const res = await fetch(`/api/admin/posts/${encodeURIComponent(initialPost.slug)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thumbnail_url: m.url }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert(txt || "Failed to set thumbnail");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input value={editor.title} onChange={(e) => editor.setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Slug</Label>
          <Input
            value={editor.slug}
            onChange={(e) => slugHandlers.onChange(e.target.value)}
            onBlur={slugHandlers.onBlur}
            onKeyDown={slugHandlers.onKeyDown}
          />
          <p className="text-[10px] text-muted-foreground">
            URL: <span className="font-mono">/blog/{editor.slug || "your-slug"}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Excerpt</Label>
        <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
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

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
          <Input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="text-[10px] text-muted-foreground">
            Tip: you can also click <span className="font-medium">Make thumbnail</span> on a media
            item.
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Content</Label>
          <Editor
            ref={editor.editorRef}
            value={editor.content}
            onChange={editor.setContent}
            className={[
              "min-h-[420px] rounded-lg border border-border bg-background/40",
              "px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")}
          />
        </div>

        <div className="space-y-3">
          <MediaList
            postId={initialPost.id}
            mediaList={editor.mediaList as any}
            setMediaList={(lst) => {
              editor.setMediaList(lst as any);
              queueSave(lst.map((m) => ({ id: m.id })));
            }}
            onInsert={(id) => {
              const m = editor.mediaList.find((x) => x.id === id);
              if (m) editor.insertPlaceholder(m as any);
            }}
            onRemove={onRemoveMedia}
            onUpload={onUpload}
            onAddLink={onAddLink}
            onCaptionChange={editor.updateCaptionInEditor}
            thumbnailUrl={thumbnailUrl || null}
            onSetThumbnail={onSetThumbnail}
            onReorderSave={(ordered) => queueSave(ordered)}
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
