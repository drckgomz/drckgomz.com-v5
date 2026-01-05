// src/components/blog/BlogView.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

import MediaCarousel from "@/components/blog/MediaCarousel";
import BlogContent from "@/components/blog/BlogContent";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ✅ Use the canonical media type that BlogContent expects
import type { MediaItem as RenderMediaItem } from "@/lib/blog/render";

// ✅ Use the canonical media type that MediaCarousel expects
import type { Media } from "@/components/blog/MediaCarousel";

type Post = {
  id: string;
  slug?: string | null;
  title: string;
  content?: string | null;
  excerpt?: string | null;
  status?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
  media?: RenderMediaItem[]; // ✅ canonical for BlogContent
};

function statusVariant(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "public") return "outline" as const;
  if (s === "private") return "secondary" as const;
  if (s === "draft") return "default" as const;
  if (s === "archived") return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "public") return "Public";
  if (s === "private") return "Private";
  if (s === "draft") return "Draft";
  if (s === "archived") return "Archived";
  return "";
}

// Helper: turn thumbnail_url into a full URL if it’s relative
function resolveUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    process.env.NEXT_PUBLIC_S3_MEDIA_BASE ||
    "https://derickgomez-images.s3.amazonaws.com";

  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function coerceMediaType(t: any): Media["type"] {
  const s = String(t || "image").toLowerCase();
  if (s === "youtube") return "youtube";
  if (s === "instagram") return "instagram";
  return "image";
}

// Normalize backend post objects into the Post type used by BlogContent
function normalizePost(raw: any): Post {
  const created_at = raw.created_at || raw.date || null;

  let media: RenderMediaItem[] = [];

  // If API returns media
  if (Array.isArray(raw.media) && raw.media.length > 0) {
    media = raw.media.map((m: any, idx: number) => ({
      // ✅ id REQUIRED by render.MediaItem
      id: String(m.id ?? `${raw.id ?? raw.slug ?? "post"}:${idx}`),
      type: coerceMediaType(m.type),
      url: String(m.url || ""),
      caption: m.caption ?? null,
      title: m.title ?? null,
    }));
  } else if (raw.thumbnail_url) {
    // Fallback to thumbnail_url if present
    media = [
      {
        id: String(raw.id ?? raw.slug ?? "thumb"),
        type: "image",
        url: resolveUrl(raw.thumbnail_url),
        caption: raw.title ?? "",
        title: raw.title ?? null,
      },
    ];
  }

  return {
    id: String(raw.id),
    slug: raw.slug ?? null,
    title: raw.title ?? "(Untitled)",
    content: raw.content ?? null,
    excerpt: raw.excerpt ?? null,
    status: raw.status ?? null,
    date: raw.date ?? null,
    created_at,
    updated_at: raw.updated_at ?? null,
    thumbnail_url: raw.thumbnail_url ?? null,
    media,
  };
}

// Convert RenderMediaItem[] into the stricter Media[] for MediaCarousel
function toCarouselMedia(items: RenderMediaItem[]): Media[] {
  return items
    .filter((m) => m && typeof m.url === "string" && m.url.length > 0)
    .map((m) => ({
      id: m.id, // required, already string
      type: coerceMediaType(m.type),
      url: m.url,
      caption: m.caption ?? null,
      title: m.title ?? null,
    }));
}

export default function BlogView({ slug }: { slug: string }) {
  const { getToken } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [post, setPost] = React.useState<Post | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken().catch(() => null);

        const qs = new URLSearchParams();
        qs.set("status", "all");

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

        const list = rawList.map(normalizePost);

        const target =
          list.find((p) => String(p.slug || "").toLowerCase() === slug.toLowerCase()) ||
          list.find((p) => String(p.id) === String(slug)) ||
          null;

        if (!mounted) return;

        if (!target) {
          setPost(null);
          setError("Post not found.");
        } else {
          setPost(target);
        }
      } catch (e: any) {
        console.error("[BlogView] load error:", e);
        if (mounted) setError(e?.message || "Failed to load post");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [slug, getToken]);

  const renderMedia: RenderMediaItem[] = Array.isArray(post?.media) ? post!.media! : [];
  const carouselMedia: Media[] = toCarouselMedia(renderMedia);

  const created =
    post?.created_at || post?.date
      ? new Date((post?.created_at || post?.date) as string)
      : null;
  const updated = post?.updated_at ? new Date(post.updated_at) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pt-28 pb-12">
      {loading ? (
        <Card className="border-white/10 bg-black">
          <CardHeader className="space-y-3">
            <div className="h-7 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
          </CardHeader>
          <Separator className="bg-white/10" />
          <CardContent className="pt-6 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-white/10" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-white/10" />
          </CardContent>
        </Card>
      ) : error ? (
        <div className="text-center text-red-400">
          {error}
          <div className="mt-6">
            <Button
              asChild
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <Link href="/blog">← Back to blog</Link>
            </Button>
          </div>
        </div>
      ) : !post ? (
        <div className="text-center text-white/70">
          Post not found.
          <div className="mt-6">
            <Button
              asChild
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-black"
            >
              <Link href="/blog">← Back to blog</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {carouselMedia.length > 0 && (
            <div className="mb-8">
              <MediaCarousel media={carouselMedia} />
            </div>
          )}

          <Card className="border-white/10 bg-black">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-2xl sm:text-3xl font-semibold text-white">
                    {post.title}
                  </CardTitle>
                </div>

                {post.status ? (
                  <Badge
                    variant={statusVariant(post.status)}
                    className="uppercase text-[10px] tracking-wide border-white/20 text-white"
                  >
                    {statusLabel(post.status)}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/60">
                {created ? <span>Created: {created.toLocaleDateString()}</span> : null}

                {updated &&
                !Number.isNaN(updated.valueOf()) &&
                (!created || updated.getTime() !== created.getTime()) ? (
                  <>
                    <span>•</span>
                    <span>Updated: {updated.toLocaleDateString()}</span>
                  </>
                ) : null}
              </div>
            </CardHeader>

            <Separator className="bg-white/10" />

            <CardContent className="pt-6">
              <BlogContent content={post.content || ""} media={renderMedia} />
            </CardContent>
          </Card>

          <div className="flex justify-center pt-10">
            <Button
              asChild
              variant="outline"
              className="border-white text-white bg-black hover:bg-white hover:text-black px-6"
            >
              <Link href="/blog">← Back to blog</Link>
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
