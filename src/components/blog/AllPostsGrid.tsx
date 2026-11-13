// src/components/blog/AllPostsGrid.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import type { OfflineBlogPost } from "@/lib/blog/offline-samples";

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
  thumbnail_url?: string | null;
  locked?: boolean;
};

type PublicPostsPayload = { items?: unknown[]; lockedPosts?: boolean };
let publicPostsRequest: Promise<PublicPostsPayload> | null = null;

function fetchPublicPosts(): Promise<PublicPostsPayload> {
  if (!publicPostsRequest) {
    publicPostsRequest = (async () => {
      const response = await fetch("/api/public/blogs?status=public", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = asRecord(payload).error;
        throw new Error(typeof message === "string" ? message : `Public posts are unavailable (${response.status}).`);
      }
      return asRecord(payload) as PublicPostsPayload;
    })().finally(() => { publicPostsRequest = null; });
  }
  return publicPostsRequest;
}

function resolveUrl(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u) return "";

  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;

  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (u.startsWith("/uploads/")) return u;
  if (u.startsWith("uploads/")) return `/${u}`;

  const base =
    process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "https://derickgomez-images.s3.amazonaws.com";
  return `${base.replace(/\/+$/, "")}/${u.replace(/^\/+/, "")}`;
}

function getYouTubeVideoId(url: string): string | undefined {
  const u = String(url || "");
  const match =
    u.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/) ||
    u.match(/[?&]v=([0-9A-Za-z_-]{11})/);
  return match?.[1];
}

function youtubeThumb(url: string) {
  const id = getYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePost(value: unknown): Post {
  const raw = asRecord(value);
  const created_at = String(raw.created_at || raw.date || "");

  const media: MediaItem[] = Array.isArray(raw.media)
    ? raw.media
        .map((value) => {
          const item = asRecord(value);
          return { type: String(item.type || "image").toLowerCase(), url: resolveUrl(String(item.url || "")) };
        })
        .filter((m: MediaItem) => Boolean(m.url))
    : [];

  const thumbnail_url = raw.thumbnail_url ? resolveUrl(String(raw.thumbnail_url)) : null;

  return {
    id: String(raw.id ?? ""),
    slug: typeof raw.slug === "string" ? raw.slug : undefined,
    title: typeof raw.title === "string" ? raw.title : "(Untitled)",
    created_at,
    media,
    status: typeof raw.status === "string" ? raw.status : undefined,
    thumbnail_url,
    locked: raw.locked === true,
  };
}

function postHref(post: Post) {
  return post.slug ? `/blog/${post.slug}` : `/blog/${post.id}`;
}

function isYoutubeUrl(u: string) {
  const s = (u || "").toLowerCase();
  return s.includes("youtu.be") || s.includes("youtube.com");
}

function getThumbnail(post: { thumbnail_url?: string | null; media?: MediaItem[] }) {
  const fallback = "/logo192.png";

  if (post.thumbnail_url) {
    const t = String(post.thumbnail_url);
    if (isYoutubeUrl(t)) return youtubeThumb(t) || fallback;
    return resolveUrl(t);
  }

  const list = Array.isArray(post.media) ? post.media : [];
  if (!list.length) return fallback;

  const first = list[0];
  const firstType = String(first?.type || "").toLowerCase();
  const firstUrl = String(first?.url || "");

  if (firstType === "youtube" || isYoutubeUrl(firstUrl)) return youtubeThumb(firstUrl) || fallback;
  if (firstType === "image" && firstUrl) return resolveUrl(firstUrl);

  const img = list.find((m) => String(m.type).toLowerCase() === "image" && m.url);
  if (img?.url) return resolveUrl(img.url);

  const yt = list.find((m) => String(m.type).toLowerCase() === "youtube" && m.url);
  if (yt?.url) return youtubeThumb(yt.url) || fallback;

  return fallback;
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || "").toLowerCase();

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
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
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

export default function AllPostsGrid({ hideTitle = false, offlinePosts, offlinePreview = false }: { hideTitle?: boolean; offlinePosts?: OfflineBlogPost[]; offlinePreview?: boolean }) {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;

    async function fetchPosts() {
      if (offlinePosts) {
        setPosts(offlinePreview
          ? [...offlinePosts, { id: "offline-locked-teaser", title: "Private post", status: "private", created_at: "", locked: true }]
          : offlinePosts);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // Public listings request only public posts. Authenticated readers use
        // the same safe endpoint; private access is resolved server-side on an
        // individual article request and never through a broad listing mode.
        // Share in-flight work so React Strict Mode's development remount does
        // not create duplicate requests. Failed requests are cleared so Retry
        // can make one fresh attempt.
        const data = await fetchPublicPosts();
        const payload = asRecord(data);
        const rawList: unknown[] = Array.isArray(data)
          ? data
          : [payload.items, payload.posts, payload.blogs].find(Array.isArray) ?? [];

        const normalized = rawList.map(normalizePost);
        if (payload.lockedPosts === true) {
          normalized.push({ id: "locked-private-teaser", title: "Private post", status: "private", created_at: "", locked: true });
        }

        if (mounted) setPosts(normalized.slice(0, 25));
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPosts();
    return () => {
      mounted = false;
    };
  }, [offlinePosts, offlinePreview, retryKey]);

  if (loading) {
    return (
      <div className="w-full">
        {!hideTitle && <h2 className="mb-6 text-center text-3xl font-bold">All Blog Posts</h2>}
        <LoadingGrid />
      </div>
    );
  }

  if (error) return <div className="mx-auto max-w-xl text-center text-red-300" role="alert">
    <p>{error}</p>
    <button type="button" className="mt-3 rounded border border-white/20 px-3 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={() => setRetryKey((value) => value + 1)}>Try again</button>
  </div>;
  if (posts.length === 0) return <p className="text-center text-white/60" role="status">
    Only published public posts appear here. Unpublished and private posts are not listed.
  </p>;

  return (
    <div className="w-full">
      {!hideTitle && <h2 className="mb-6 text-center text-3xl font-bold">All Blog Posts</h2>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {posts.map((post) => {
          if (post.locked) {
            return (
              <Card key={post.id} className="h-full overflow-hidden bg-black border border-white/10">
                <div className="relative aspect-video overflow-hidden border-b border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black grid place-items-center">
                  <span className="text-xs uppercase tracking-[0.2em] text-white/45">Private post</span>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-center sm:justify-start">
                    <h3 className="text-base font-semibold text-white">Private post</h3>
                    <StatusBadge status="private" />
                  </div>
                  <p className="mt-2 text-sm text-white/70">Sign up or sign in to request access.</p>
                  {!offlinePreview && <div className="mt-3 flex gap-4 text-sm">
                    <Link href="/sign-up" className="text-white underline underline-offset-4">Sign up</Link>
                    <Link href="/sign-in" className="text-white/70 underline underline-offset-4">Sign in</Link>
                  </div>}
                </CardContent>
              </Card>
            );
          }
          const thumbnail = getThumbnail(post);

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
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo192.png";
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center justify-center sm:justify-start">
                        <h3 className="truncate text-base font-semibold text-white">{post.title}</h3>
                        <StatusBadge status={post.status} />
                      </div>

                      <p className="mt-1 text-xs text-white/60">
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : ""}
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
