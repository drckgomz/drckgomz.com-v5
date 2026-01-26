// src/components/admin/editor/MediaList.tsx
"use client";

import * as React from "react";
import { ReactSortable } from "react-sortablejs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/utils";

import { getYouTubeVideoId, type NormalizedMedia } from "./media";

function deriveFallbackLabel(m: NormalizedMedia, i: number) {
  if (m.type === "youtube") {
    const vid = getYouTubeVideoId(m.url);
    return vid ? `YouTube: ${vid}` : "YouTube video";
  }
  if (m.type === "instagram") {
    try {
      const u = new URL(m.url);
      const parts = u.pathname.split("/").filter(Boolean);
      const kind = parts[0] || "Instagram";
      const code = parts[1] || "";
      return code ? `Instagram ${kind}: ${code}` : "Instagram";
    } catch {
      /* ignore */
    }
    return "Instagram";
  }
  return `Image ${i + 1}`;
}

export default function MediaList({
  postId,
  mediaList,
  setMediaList,
  onInsert,
  onRemove,
  onUpload,
  onAddLink,
  onCaptionChange,
  thumbnailUrl,
  onSetThumbnail,
  onReorderSave,
}: {
  postId: string;
  mediaList: NormalizedMedia[];
  setMediaList: (list: NormalizedMedia[]) => void;
  onInsert: (id: string) => void;
  onRemove: (id: string) => void;
  onUpload: (file: File) => void;
  onAddLink: (url: string, cb?: (id: string) => void) => void;
  onCaptionChange?: (m: NormalizedMedia, newCaption: string | null) => void;
  thumbnailUrl?: string | null;
  onSetThumbnail?: (m: { id: string; url: string }) => void;
  onReorderSave?: (ordered: { id: string }[]) => void;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [dropping, setDropping] = React.useState(false);

  // debounce reorder saves
  const reorderTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueReorderSave = React.useCallback(
    (list: NormalizedMedia[]) => {
      if (!onReorderSave || !postId) return;
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(() => {
        onReorderSave(list.map((m) => ({ id: m.id })));
      }, 350);
    },
    [onReorderSave, postId]
  );

  const fileRef = React.useRef<HTMLInputElement>(null);
  const pickFile = () => fileRef.current?.click();

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.currentTarget.value = "";
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) onUpload(f);
  };

  const startEdit = (m: NormalizedMedia) => {
    setEditingId(m.id);
    setDraft((typeof m.caption === "string" ? m.caption : "") || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const saveCaption = async (id: string, captionRaw: string) => {
    setSavingId(id);

    const clean = (captionRaw ?? "").toString().trim();
    const newCaption: string | null = clean.length ? clean : null;

    const before = mediaList;
    const next = before.map((m) => (m.id === id ? { ...m, caption: newCaption } : m));
    setMediaList(next);

    try {
      // If you already persist captions server-side elsewhere, keep that there.
      // If not, this is where you’d call it.
      const updated = next.find((x) => x.id === id);
      if (updated && onCaptionChange) onCaptionChange(updated, newCaption);

      setEditingId(null);
      setDraft("");
    } catch {
      setMediaList(before);
    } finally {
      setSavingId(null);
    }
  };

  const commit = () => {
    if (!editingId) return;
    saveCaption(editingId, draft.trim());
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Media</h2>
        <p className="text-[11px] text-muted-foreground">
          Attach media and insert placeholders into the post content.
        </p>
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={async () => {
            const url = prompt("Enter YouTube or Instagram URL:");
            if (url) onAddLink(url, () => {});
          }}
        >
          + Add YouTube / Instagram
        </Button>

        <Button type="button" className="w-full" onClick={pickFile}>
          Upload image
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          aria-label="Upload image"
        />
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        className={cn(
          "rounded-xl border border-dashed p-3 text-xs transition-colors",
          dropping
            ? "border-primary/50 bg-primary/5 text-foreground"
            : "border-border bg-muted/30 text-muted-foreground"
        )}
      >
        Drag &amp; drop an image here
      </div>

      <Separator />

      {mediaList.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          No media yet.
        </div>
      ) : (
        <ReactSortable
          list={mediaList}
          setList={(lst) => {
            setMediaList(lst as NormalizedMedia[]);
            queueReorderSave(lst as NormalizedMedia[]);
          }}
          animation={150}
          className="space-y-2"
        >
          {mediaList.map((m, i) => {
            const thumb =
              m.type === "image"
                ? m.url
                : m.type === "youtube"
                ? `https://img.youtube.com/vi/${getYouTubeVideoId(m.url)}/hqdefault.jpg`
                : null;

            const cap = (typeof m.caption === "string" ? m.caption.trim() : null) || null;
            const ttl = (typeof m.title === "string" ? m.title.trim() : null) || null;
            const display = cap || ttl || deriveFallbackLabel(m, i);
            const isEditing = editingId === m.id;
            const isThumb = !!thumbnailUrl && m.url === thumbnailUrl;

            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border bg-background p-3 shadow-sm",
                  "hover:bg-muted/20"
                )}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={display}
                    className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border">
                    IG
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          disabled={savingId === m.id}
                          className="h-8 text-xs"
                          placeholder="Caption…"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="block w-full truncate text-left text-xs font-medium text-foreground hover:underline"
                          title="Click to edit caption"
                        >
                          {display}
                        </button>
                      )}

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {m.type !== "image" ? (
                          <span className="uppercase tracking-wide">{m.type}</span>
                        ) : (
                          <span className="uppercase tracking-wide">image</span>
                        )}
                        {isThumb ? (
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/20">
                            Thumbnail
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onInsert(m.id)}
                      disabled={!!savingId}
                    >
                      Insert
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onRemove(m.id)}
                    >
                      Remove
                    </Button>

                    {!isThumb && onSetThumbnail ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onSetThumbnail({ id: m.id, url: m.url })}
                        title="Use as post thumbnail"
                      >
                        Make thumbnail
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </ReactSortable>
      )}
    </section>
  );
}
