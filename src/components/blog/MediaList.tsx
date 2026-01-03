// frontend/src/features/blog/components/MediaList.tsx
"use client";

import * as React from "react";
import { ReactSortable } from "react-sortablejs";
import { getYouTubeVideoId } from "@/lib/blog/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/utils";

type MediaItem = {
  id: string;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null;
  title?: string | null;
  idx?: number | null;
  created_at?: string | null;
  [k: string]: any;
};

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE
    ? process.env.NEXT_PUBLIC_API_BASE
    : "http://localhost:3001";


const DBG = (label: string, payload?: any) =>
  console.debug(`[MediaList] ${label}`, payload);

function deriveFallbackLabel(m: MediaItem, i: number) {
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
  mediaList: MediaItem[];
  setMediaList: (list: MediaItem[]) => void;
  onInsert: (id: string) => void;
  onRemove: (id: string) => void;
  onUpload: (file: File) => void;
  onAddLink: (url: string, cb?: (id: string) => void) => void;
  onCaptionChange?: (m: MediaItem, newCaption: string | null) => void;
  thumbnailUrl?: string | null;
  onSetThumbnail?: (m: { id: string; url: string }) => void;
  onReorderSave?: (ordered: { id: string }[]) => void;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<string>("");
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [dropping, setDropping] = React.useState(false);

  React.useEffect(() => {
    DBG("mount", { postId, count: mediaList.length, sample: mediaList.slice(0, 3) });
  }, [postId, mediaList.length]);

  // debounce reorder saves (if parent wants to persist order)
  const reorderTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueReorderSave = React.useCallback(
    (list: MediaItem[]) => {
      DBG(
        "queueReorderSave:incoming",
        list.map((m, i) => ({ i, id: m.id }))
      );
      if (!onReorderSave || !postId) return;
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(() => {
        DBG(
          "queueReorderSave:fire",
          list.map((m, i) => ({ i, id: m.id }))
        );
        onReorderSave(list.map((m) => ({ id: m.id })));
      }, 350);
    },
    [onReorderSave, postId]
  );

  // Upload
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pickFile = () => {
    DBG("pickFile");
    fileRef.current?.click();
  };
  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    DBG("onFile", { hasFile: !!f, name: f?.name, type: f?.type, size: f?.size });
    if (f) onUpload(f);
    e.currentTarget.value = "";
  };

  // Drag & drop upload
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files?.[0];
    DBG("onDrop", { hasFile: !!f, name: f?.name, type: f?.type, size: f?.size });
    if (f && f.type.startsWith("image/")) onUpload(f);
  };

  // caption editing
  const startEdit = (m: MediaItem) => {
    DBG("startEdit", m);
    setEditingId(m.id);
    setDraft((typeof m.caption === "string" ? m.caption : "") || "");
  };
  const cancelEdit = () => {
    DBG("cancelEdit");
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
    DBG("saveCaption → PATCH /v1/admin/media", { id, caption: newCaption });

    try {
      const url = new URL("/v1/admin/media", API_BASE).toString();

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, caption: newCaption }),
      });

      DBG("saveCaption status", { ok: res.ok, status: res.status });
      if (!res.ok) throw new Error(await res.text().catch(() => "Failed to save"));

      const updated = next.find((x) => x.id === id);
      if (updated && onCaptionChange) onCaptionChange(updated, newCaption);
      setEditingId(null);
      setDraft("");
    } catch (e) {
      console.error(e);
      alert("Failed to save caption — reverted");
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
    <section className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Media
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Attach media and insert placeholders into the post content.
          </p>
        </div>
      </div>

      {/* Add link + upload (stacked) */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={async () => {
            const url = prompt("Enter YouTube or Instagram URL:");
            DBG("AddLink prompt", { url });
            if (url) onAddLink(url, () => {});
          }}
        >
          + Add YouTube / Instagram
        </Button>

        <Button
          type="button"
          size="sm"
          className="w-full justify-center"
          onClick={pickFile}
        >
          ⬆ Upload image
        </Button>

        <input
          id="media-upload"
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          aria-label="Upload image"
        />
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        className={cn(
          "mt-1 rounded-lg border-2 border-dashed p-3 text-xs transition-colors",
          dropping
            ? "border-primary/60 bg-primary/10 text-primary-foreground/80"
            : "border-border/60 bg-background/60 text-muted-foreground"
        )}
      >
        Drag & drop an image here
      </div>

      <Separator className="bg-border/70" />

      {mediaList.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
          No media found for this post yet.
        </div>
      )}

      {/* Sortable list */}
      <ReactSortable
        list={mediaList}
        setList={(lst) => {
          DBG(
            "ReactSortable.setList",
            lst.map((m, i) => ({ i, id: m.id }))
          );
          setMediaList(lst as MediaItem[]);
          queueReorderSave(lst as MediaItem[]);
        }}
        animation={150}
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
          const isThumb = thumbnailUrl && m.url === thumbnailUrl;

          DBG("render item", {
            i,
            id: m.id,
            type: m.type,
            use: cap ? "caption" : ttl ? "title" : "fallback",
            idx: m.idx,
            created_at: m.created_at,
            display,
          });

          return (
            <div
              key={m.id}
              className="mb-2 flex items-start rounded-lg border border-border/60 bg-background/70 p-2"
            >
              {/* Thumbnail */}
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={display}
                  className="h-14 w-14 rounded object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                  IG
                </div>
              )}

              {/* Meta + actions */}
              <div className="ml-2 flex-1 space-y-1">
                <div className="flex items-center gap-2">
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
                      className="h-7 w-full bg-background/60 text-xs"
                      placeholder="Enter a caption…"
                      aria-label="Edit media caption"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="max-w-full truncate text-left text-xs text-foreground hover:underline"
                      title="Click to edit caption"
                    >
                      {display}
                    </button>
                  )}

                  {isThumb && (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      Thumbnail
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary hover:bg-primary/10"
                    onClick={() => onInsert(m.id)}
                    disabled={!!savingId}
                  >
                    Insert
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(m.id)}
                  >
                    Remove
                  </Button>

                  {!isThumb && onSetThumbnail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-amber-300 hover:bg-amber-500/10"
                      title="Use as post thumbnail"
                      onClick={() => onSetThumbnail({ id: m.id, url: m.url })}
                    >
                      Make thumbnail
                    </Button>
                  )}

                  {m.type !== "image" && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.type}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </ReactSortable>
    </section>
  );
}
