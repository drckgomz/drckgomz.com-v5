// src/components/admin/posts/EditPostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

import BlogContent from "@/components/blog/BlogContent";
import Editor from "@/components/admin/editor/Editor";
import { usePostEditor } from "@/components/admin/editor/usePostEditor";
import type { AdminPost, PostStatus } from "@/lib/admin/types";

export default function EditPostForm({ initialPost, metadataEditable = false }: { initialPost: AdminPost; metadataEditable?: boolean }) {
  const router = useRouter();

  const { editorRef, ...editor } = usePostEditor(
    {
      id: initialPost.id,
      title: initialPost.title ?? "",
      slug: initialPost.slug ?? "",
      content: initialPost.editor_content ?? initialPost.content ?? "",
      media: initialPost.media ?? [],
    },
    { mode: "edit", slug: initialPost.slug }
  );

  const [excerpt, setExcerpt] = React.useState(initialPost.excerpt ?? "");
  const [status, setStatus] = React.useState<PostStatus>(
    (initialPost.status ?? "draft") as PostStatus
  );
  const [thumbnailUrl, setThumbnailUrl] = React.useState(initialPost.thumbnail_url ?? "");

  const [date, setDate] = React.useState(initialPost.date ?? "");
  const [savedMetadata, setSavedMetadata] = React.useState({ excerpt: initialPost.excerpt ?? "", date: initialPost.date ?? "" });
  const [revision, setRevision] = React.useState(initialPost.revision ?? 1);
  const [notice, setNotice] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [savedTitle, setSavedTitle] = React.useState(initialPost.title ?? "");
  const [savedContent, setSavedContent] = React.useState(initialPost.editor_content ?? initialPost.content ?? "");
  const dirty = editor.title !== savedTitle || editor.content !== savedContent || excerpt !== savedMetadata.excerpt || date !== savedMetadata.date;
  const legacyImagePreviews = editor.mediaList.filter((item) =>
    item.type === "image" && /^\/api\/dev\/legacy-media-preview\/[A-Za-z0-9_-]{1,128}$/.test(item.url)
  );
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const intercept = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!window.confirm("Discard unsaved changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", intercept, true); };
  }, [dirty]);

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const savingRef = React.useRef(false);
  async function onSave() {
    if (savingRef.current) return;
    setErr(null);
    setNotice("");
    savingRef.current = true;
    setSaving(true);

    try {
      const payload: { expected_revision: number; title?: string; content?: string; excerpt?: string | null; date?: string | null } = { expected_revision: revision };
      if (editor.title !== savedTitle) payload.title = editor.title.trim();
      if (editor.content !== savedContent) payload.content = editor.content;
      if (metadataEditable && excerpt !== savedMetadata.excerpt) payload.excerpt = excerpt.trim() || null;
      if (metadataEditable && date !== savedMetadata.date) payload.date = date || null;
      if (Object.keys(payload).length === 1) throw new Error("There are no changes to save.");
      if (payload.title !== undefined && !payload.title) throw new Error("Title is required.");

      const res = await fetch(`/api/admin/posts/${encodeURIComponent(initialPost.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      const saved: AdminPost | undefined = json?.post;
      setRevision(saved?.revision ?? revision + 1);
      setSavedTitle(editor.title.trim());
      editor.setTitle(editor.title.trim());
      const metadata = { excerpt: saved?.excerpt ?? excerpt.trim(), date: saved?.date ?? date };
      setExcerpt(metadata.excerpt); setDate(metadata.date); setSavedMetadata(metadata);
      const canonical = saved?.editor_content ?? editor.content;
      editor.setContent(canonical);
      setSavedContent(canonical);
      setNotice("Post changes saved.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite">{saving ? "Saving changes…" : dirty ? "Unsaved changes" : notice || "All changes saved"}</p>
      {editor.mediaError && <p role="alert" className="text-sm text-destructive">{editor.mediaError}</p>}
      {err ? (
        <div role="alert" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      {/* Top fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-title" className="text-xs font-medium text-foreground/80">Title</Label>
          <Input id="post-title" disabled={saving}
            value={editor.title}
            onChange={(e) => editor.setTitle(e.target.value)}
            placeholder="Post title…"
            className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-slug" className="text-xs font-medium text-foreground/80">Slug</Label>
          <Input id="post-slug" disabled
            value={editor.slug}
            onChange={(e) => editor.setSlug(e.target.value)}
            placeholder="post-slug"
            className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground">
            URL: <span className="font-mono text-foreground/70">/blog/{editor.slug || "your-slug"}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-excerpt" className="text-xs font-medium text-foreground/80">Excerpt</Label>
        <Textarea id="post-excerpt" disabled={!metadataEditable || saving} maxLength={2000}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={4}
          placeholder="Short summary for the blog feed…"
          className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-[11px] text-muted-foreground">Tip: 1–2 sentences reads best.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-date">Display date</Label>
        <Input id="post-date" type="date" disabled={!metadataEditable || saving} value={date} onChange={e => setDate(e.target.value)} />
        <p className="text-xs text-muted-foreground">Changing the display date does not publish or schedule a post. Current revision: {revision}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-status" className="text-xs font-medium text-foreground/80">Status</Label>
          <select id="post-status" disabled
            value={status}
            onChange={(e) => setStatus(e.target.value as PostStatus)}
            className={[
              "h-10 w-full rounded-md px-3 text-sm",
              "border border-border bg-muted/40 text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")}
          >
            <option value="draft">draft</option>
            <option value="private">private</option>
            <option value="public">public</option>
            <option value="archived">archived</option>
          </select>
          <p className="text-[11px] text-muted-foreground">Publication state cannot be changed in this editing step.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-thumbnail" className="text-xs font-medium text-foreground/80">Thumbnail URL</Label>
          <Input id="post-thumbnail" disabled
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://..."
            className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground">
            Tip: you can also click <span className="font-medium text-foreground/70">Make thumbnail</span>{" "}
            on a media item.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Title and content changes use revision checks. Excerpt and display date require the approved metadata grant. Manage publication from the post list. Slug and thumbnail editing remain unavailable.</p>

      <Separator className="bg-border" />

      {initialPost.legacy_content && <p role="status" className="rounded border border-border p-3">Recovered source content is protected and read-only. Title-only saves preserve its original bytes.</p>}
      {/* Editor + media (aligned) */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] md:items-start">
        {/* Left column: keep label + editor in a "row" so the top aligns with the media card */}
        <div className="grid min-w-0 gap-2">
          <div className="flex h-7 items-end">
            <Label className="text-xs font-medium text-foreground/80">Content</Label>
          </div>

          <Editor
            readOnly={saving || initialPost.legacy_content === true}
            ref={editorRef}
            value={editor.content}
            onChange={editor.setContent}
            className={[
              "min-h-[460px] rounded-lg border border-border bg-muted/40",
              "px-3 py-2 text-sm text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")}
          />

          <p className="text-[11px] text-muted-foreground">
            Use the Media panel to insert placeholders into the editor.
          </p>
        </div>

        {/* Right column: match the label row height so the card top lines up with the editor top */}
        <div className="grid min-w-0 gap-2">
          <div className="flex h-7 items-end">
            <p className="text-xs font-medium text-foreground/80">Media</p>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
            {legacyImagePreviews.length ? legacyImagePreviews.map((item, index) => (
              <figure key={item.id} className="space-y-2">
                {/* This source is a same-origin, owner-authorized, no-store local preview route. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption?.trim() || item.title?.trim() || `Attached image ${index + 1}`}
                  className="max-h-72 w-full rounded-md bg-background object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {item.caption?.trim() && <figcaption className="text-xs text-muted-foreground">{item.caption}</figcaption>}
                {!initialPost.legacy_content && <Button type="button" variant="outline" onClick={() => editor.insertPlaceholder(item)}>Insert image into content</Button>}
              </figure>
            )) : (
              <p className="text-sm text-muted-foreground">
                {editor.mediaList.length
                  ? "Attached media is preserved. This local preview currently supports validated historical images."
                  : "No attached media."}
              </p>
            )}
            {!initialPost.legacy_content && editor.mediaList.filter(item => !legacyImagePreviews.some(preview => preview.id === item.id) && ["image", "youtube", "instagram"].includes(item.type)).map(item => (
              <Button key={item.id} type="button" variant="outline" className="h-auto max-w-full whitespace-normal break-words" onClick={() => editor.insertPlaceholder(item)}>Insert {item.title || item.caption || item.type}</Button>
            ))}
            <p className="text-xs text-muted-foreground">
              Historical image previews are served through an owner-authorized local route. Upload, replacement, and removal remain unavailable here.
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      <Button type="button" variant="outline" aria-expanded={preview} onClick={() => setPreview(!preview)}>
        {preview ? "Hide preview" : "Preview unsaved post"}
      </Button>
      {preview && <section aria-label="Unsaved post preview" className="min-w-0 rounded-lg border border-border p-4">
        <p className="text-sm">Preview only — does not publish or save changes. Media URLs may already be public.</p>
        <h2>{editor.title}</h2>
        <BlogContent content={editor.content} media={editor.mediaList.filter((m): m is typeof m & { type: "image" | "youtube" | "instagram" } => ["image", "youtube", "instagram"].includes(m.type))} />
      </section>}
      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="ghost"
          className="bg-secondary text-secondary-foreground text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) router.back(); }}
          disabled={saving}
        >
          Cancel
        </Button>

        <Button
          type="button"
          className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save post"}
        </Button>
      </div>
    </div>
  );
}
