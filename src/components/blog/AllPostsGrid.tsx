// src/components/blog/AllPostsGrid.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type MediaItem = { type: string; url: string };

type Post = {
  id: string;
  slug?: string;
  title: string;
  created_at: string;
  media?: MediaItem[];
  status?: string;
};

function resolveUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    process.env.NEXT_PUBLIC_S3_MEDIA_BASE ||
    "https://derickgomez-images.s3.amazonaws.com";

  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function normalizePost(raw: any): Post {
  const created_at = raw.created_at || raw.date || "";

  let media: MediaItem[] = [];
  if (Array.isArray(raw.media) && raw.media.length > 0) {
    media = raw.media.map((m: any) => ({
      type: m.type || "image",
      url: String(m.url || ""),
    }));
  } else if (raw.thumbnail_url) {
    media = [{ type: "image", url: resolveUrl(raw.thumbnail_url) }];
  }

  return {
    id: String(raw.id),
    slug: raw.slug ?? undefined,
    title: raw.title ?? "(Untitled)",
    created_at,
    media,
    status: raw.status ?? undefined,
  };
}

function postHref(post: Post) {
  return post.slug ? `/blog/${post.slug}` : `/blog/${post.id}`;
}

function getThumbnail(mediaList?: MediaItem[]) {
  const fallback = "/logo192.png";
  if (!mediaList?.length) return fallback;

  const top = mediaList[0];
  if (!top?.url) return fallback;

  if (top.type === "image") return top.url;

  if (top.type === "youtube") {
    const url = top.url;
    const videoId =
      url.split("v=")[1]?.split("&")[0] ||
      url.split("/").filter(Boolean).pop();
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  return fallback;
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || "").toLowerCase();

  // if you still want to show these badges on the protected blog home, keep them.
  // if not, just return null.
  const label =
    s === "public"
      ? "Public"
      : s === "private"
      ? "Private"
      : s === "draft"
      ? "Draft"
      : s === "archived"
      ? "Archived"
      : "";

  if (!label) return null;

  const variantClass =
    s === "public"
      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
      : s === "private"
      ? "bg-blue-500/15 text-blue-200 border-blue-500/30"
      : s === "archived"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
      : "bg-white/10 text-white/80 border-white/20";

  return (
    <Badge
      variant="outline"
      className={`ml-2 border text-[10px] uppercase tracking-wide ${variantClass}`}
    >
      {label}
    </Badge>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="bg-black border border-white/10 overflow-hidden">
          <div className="aspect-video">
            <Skeleton className="h-full w-full" />
          </div>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default function AllPostsGrid({ hideTitle = false }: { hideTitle?: boolean }) {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { getToken } = useAuth();

  React.useEffect(() => {
    let mounted = true;

    async function fetchPosts() {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken().catch(() => null);

        const qs = new URLSearchParams();
        qs.set("status", "all"); // keep your current behavior

        const res = await fetch(`/api/public/blogs?${qs.toString()}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`API ${res.status} ${text}`);
        }

        const data = await res.json();

        const rawList: any[] = Array.isArray(data)
          ? data
          : data.items ?? data.posts ?? data.blogs ?? [];

        const normalized = rawList.map(normalizePost);

        if (mounted) setPosts(normalized.slice(0, 25));
      } catch (err: any) {
        console.error("[AllPostsGrid] fetch error:", err);
        if (mounted) setError(err?.message ?? "Failed to load posts");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPosts();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  if (loading) {
    return (
      <div className="w-full">
        {!hideTitle && (
          <h2 className="mb-6 text-center text-3xl font-bold">All Blog Posts</h2>
        )}
        <LoadingGrid />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (posts.length === 0) {
    return <div className="text-center text-white/60">No blog posts found.</div>;
  }

  return (
    <div className="w-full">
      {!hideTitle && (
        <h2 className="mb-6 text-center text-3xl font-bold">All Blog Posts</h2>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const thumbnail = getThumbnail(post.media);

          return (
            <Link
              key={post.id}
              href={postHref(post)}
              className="group focus-visible:outline-none"
              aria-label={`Open blog post: ${post.title}`}
            >
              <Card
                className="
                  h-full overflow-hidden
                  bg-black border border-white/10
                  transition
                  group-hover:-translate-y-0.5
                  group-hover:border-white/20
                  group-focus-visible:ring-2 group-focus-visible:ring-white/60
                "
              >
                <div className="relative aspect-video overflow-hidden border-b border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnail}
                    alt={post.title}
                    className="
                      h-full w-full object-cover
                      transition-transform duration-300
                      group-hover:scale-[1.02]
                    "
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo192.png";
                    }}
                  />

                  {/* subtle overlay on hover */}
                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center justify-center sm:justify-start">
                        <h3 className="truncate text-base font-semibold text-white">
                          {post.title}
                        </h3>
                        <StatusBadge status={post.status} />
                      </div>

                      <p className="mt-1 text-xs text-white/60">
                        {post.created_at
                          ? new Date(post.created_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
