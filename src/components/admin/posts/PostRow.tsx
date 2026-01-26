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
  return img?.url || fallback || "/default-thumbnail.png";
}

type Props = {
  post: PostWithMedia;
  thumbUrl?: string;
  onMakePublic: (slug: string) => void;
  onMakePrivate: (slug: string) => void;
  onMakeDraft: (slug: string) => void;
  onArchive: (slug: string) => void;
  onUnarchive: (slug: string) => void;
  onDelete: (slug: string) => void;
  /** v5 route for edit page */
  editHref?: (slug: string) => string;
};

export default function PostRow({
  post: p,
  thumbUrl,
  onMakePublic,
  onMakePrivate,
  onMakeDraft,
  onArchive,
  onUnarchive,
  onDelete,
  editHref = (slug) => `/admin/posts/${slug}`,
}: Props) {
  const router = useRouter();

  const thumb = React.useMemo(
    () => thumbUrl ?? topMediaThumb(p.media, p.thumbnail_url),
    [thumbUrl, p.media, p.thumbnail_url]
  );

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={`${p.title || p.slug} thumbnail`}
          className="h-14 w-14 rounded-lg object-cover bg-muted"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/default-thumbnail.png";
          }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-white border-2 border-white text-[11px] hover:bg-white hover:text-black"
          onClick={() => router.push(editHref(p.slug))}
        >
          Edit
        </Button>

        {p.status !== "public" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] bg-white/5 border-2 border-emerald-600 text-emerald-300 hover:bg-emerald-600 hover:text-white"
            onClick={() => onMakePublic(p.slug)}
          >
            Make public
          </Button>
        )}

        {p.status !== "private" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] bg-white/5 border-2 border-blue-500 text-blue-300 hover:bg-blue-600 hover:text-white"
            onClick={() => onMakePrivate(p.slug)}
          >
            Make private
          </Button>
        )}

        {p.status !== "draft" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] bg-white/5 text-purple-300 border-2 border-purple-500 hover:bg-purple-500 hover:text-white"
            onClick={() => onMakeDraft(p.slug)}
          >
            Move to draft
          </Button>
        )}

        {p.status !== "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] bg-white/5 border-2 border-amber-600 text-amber-300 hover:bg-amber-500 hover:text-white"
            onClick={() => onArchive(p.slug)}
          >
            Archive
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] bg-white/5 border-2 border-amber-600 text-amber-300 hover:bg-amber-600 hover:text-white"
            onClick={() => onUnarchive(p.slug)}
          >
            Unarchive
          </Button>
        )}


        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-[11px] bg-destructive/90 hover:bg-white hover:text-red-600"
          onClick={() => onDelete(p.slug)}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
