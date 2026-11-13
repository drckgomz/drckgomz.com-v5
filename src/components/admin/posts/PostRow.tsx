// src/components/blog/admin/posts/PostRow.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import type { Post } from "./types";
import { Button } from "@/components/ui/button";

type MediaItem = {
  type: "image" | "youtube" | "instagram";
  url: string;
  idx?: number | null;
};

type PostWithMedia = Post & { media?: MediaItem[] | null };

function topMediaThumb(media?: MediaItem[] | null, fallback?: string | null) {
  const img = (media ?? []).find((m) => m.type === "image" && m.url);
  return img?.url || fallback || null;
}

type Props = {
  busy?: boolean;
  post: PostWithMedia;
  thumbUrl?: string | null;
  onMakePublic: (slug: string) => void;
  onMakePrivate: (slug: string) => void;
  onMakeDraft: (slug: string) => void;
  onArchive: (slug: string) => void;
  onUnarchive: (slug: string) => void;
  onDelete: (slug: string) => void;
  onDuplicate?: (slug: string) => void;
  /** v5 route for edit page */
  editHref?: (slug: string) => string;
};

export default function PostRow({
  busy = false,
  post: p,
  thumbUrl,
  onMakePublic,
  onMakePrivate,
  onMakeDraft,
  onArchive,
  onUnarchive,
  onDelete,
  onDuplicate,
  editHref = (slug) => `/admin/posts/${encodeURIComponent(slug)}`,
}: Props) {
  const router = useRouter();

  const thumb = React.useMemo(
    () => thumbUrl ?? topMediaThumb(p.media, p.thumbnail_url),
    [thumbUrl, p.media, p.thumbnail_url]
  );

  return (
    <li className="flex flex-col items-stretch sm:flex-row sm:items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumb}
            alt={`${p.title || p.slug} thumbnail`}
            className="h-14 w-14 rounded-lg object-cover bg-muted"
          />
        ) : (
          <div aria-label="No media preview" className="h-14 w-14 shrink-0 rounded-lg border border-border bg-muted/60" />
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {p.title || p.slug}
            </span>
            <StatusBadge status={p.status} />
          </div>

          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            /blog/{p.slug}
            {p.updated_at && (
              <>
                {" "}
                • updated{" "}
                {new Date(p.updated_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
        {onDuplicate && <Button type="button" disabled={busy} variant="outline" onClick={() => onDuplicate(p.slug)}>Duplicate text</Button>}
        <Button
          type="button" disabled={busy}
          size="sm"
          variant="ghost"
          className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
          onClick={() => router.push(editHref(p.slug))}
        >
          Edit
        </Button>

        {p.status !== "public" && (
          <Button
            type="button" disabled={busy}
            size="sm"
            variant="outline"
            className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => onMakePublic(p.slug)}
          >
            Make public
          </Button>
        )}

        {p.status !== "private" && (
          <Button
            type="button" disabled={busy}
            size="sm"
            variant="outline"
            className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => onMakePrivate(p.slug)}
          >
            Make private
          </Button>
        )}

        {p.status !== "draft" && (
          <Button
            type="button" disabled={busy}
            size="sm"
            variant="outline"
            className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => onMakeDraft(p.slug)}
          >
            Move to draft
          </Button>
        )}

        {p.status !== "archived" ? (
          <Button
            type="button" disabled={busy}
            size="sm"
            variant="outline"
            className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => onArchive(p.slug)}
          >
            Archive
          </Button>
        ) : (
          <Button
            type="button" disabled={busy}
            size="sm"
            variant="outline"
            className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => onUnarchive(p.slug)}
          >
            Unarchive
          </Button>
        )}


        <Button
          type="button" disabled={busy}
          size="sm"
          variant="destructive"
          className="min-h-11 px-3 text-xs border border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground"
          onClick={() => onDelete(p.slug)}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
