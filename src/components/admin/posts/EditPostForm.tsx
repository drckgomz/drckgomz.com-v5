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

    const res = await fetch(`/api/admin/posts/${encodeURIComponent(initialPost.slug)}/media/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: detectMediaType(clean),
        url: clean,
      }),
    });

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

    const res = await fetch(`/api/admin/posts/${encodeURIComponent(initialPost.slug)}/media/upload`, {
      method: "POST",
      body: fd,
    });

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

    const slugForPatch = editor.slug?.trim() || initialPost.slug;

    const res = await fetch(`/api/admin/posts/${encodeURIComponent(slugForPatch)}`, {
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
      {err ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      {/* Top fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-white/80">Title</Label>
          <Input
            value={editor.title}
            onChange={(e) => editor.setTitle(e.target.value)}
            placeholder="Post title…"
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-white/80">Slug</Label>
          <Input
            value={editor.slug}
            onChange={(e) => slugHandlers.onChange(e.target.value)}
            onBlur={slugHandlers.onBlur}
            onKeyDown={slugHandlers.onKeyDown}
            placeholder="post-slug"
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
          <p className="text-[11px] text-white/50">
            URL: <span className="font-mono text-white/70">/blog/{editor.slug || "your-slug"}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-white/80">Excerpt</Label>
        <Textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={4}
          placeholder="Short summary for the blog feed…"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />
        <p className="text-[11px] text-white/50">Tip: 1–2 sentences reads best.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-white/80">Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className={[
              "h-10 w-full rounded-md px-3 text-sm",
              "border border-white/10 bg-white/5 text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            ].join(" ")}
          >
            <option value="draft">draft</option>
            <option value="private">private</option>
            <option value="public">public</option>
            <option value="archived">archived</option>
          </select>
          <p className="text-[11px] text-white/50">This controls visibility on your public blog.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-white/80">Thumbnail URL</Label>
          <Input
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://..."
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
          <p className="text-[11px] text-white/50">
            Tip: you can also click <span className="font-medium text-white/70">Make thumbnail</span>{" "}
            on a media item.
          </p>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Editor + media (aligned) */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] md:items-start">
        {/* Left column: keep label + editor in a "row" so the top aligns with the media card */}
        <div className="grid gap-2">
          <div className="flex h-7 items-end">
            <Label className="text-xs font-medium text-white/80">Content</Label>
          </div>

          <Editor
            ref={editor.editorRef}
            value={editor.content}
            onChange={editor.setContent}
            className={[
              "min-h-[460px] rounded-lg border border-white/10 bg-white/5",
              "px-3 py-2 text-sm text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            ].join(" ")}
          />

          <p className="text-[11px] text-white/50">
            Use the Media panel to insert placeholders into the editor.
          </p>
        </div>

        {/* Right column: match the label row height so the card top lines up with the editor top */}
        <div className="grid gap-2">
          <div className="flex h-7 items-end">
            <p className="text-xs font-medium text-white/80">Media</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] text-white/50">Drag to reorder</p>
              <div className="h-4" />
            </div>

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
      </div>

      <Separator className="bg-white/10" />

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="ghost"
          className="bg-white/25 text-white hover:bg-white hover:text-black"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </Button>

        <Button
          type="button"
          className="bg-white/25 hover:bg-white hover:text-black"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
