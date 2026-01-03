// frontend/src/features/blog/components/AllPostsGrid.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

type MediaItem = { type: string; url: string };

type Post = {
  id: string;
  slug?: string;
  title: string;
  created_at: string;
  media?: MediaItem[];
  status?: string;
};

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

  const className =
    s === "public"
      ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/40"
      : s === "private"
      ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-600/40"
      : s === "archived"
      ? "bg-amber-600/20 text-amber-300 ring-1 ring-amber-600/40"
      : "bg-gray-600/20 text-gray-300 ring-1 ring-gray-600/40";

  return (
    <span
      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

// Helper: turn thumbnail_url into a full URL if it’s relative
function resolveUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // you likely want NEXT_PUBLIC_S3_MEDIA_BASE based on your env
  const base =
    process.env.NEXT_PUBLIC_S3_MEDIA_BASE ||
    "https://derickgomez-images.s3.amazonaws.com";

  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

// Normalize backend post objects into the Post type used by the UI
function normalizePost(raw: any): Post {
  const created_at = raw.created_at || raw.date || "";

  let media: MediaItem[] = [];

  if (Array.isArray(raw.media) && raw.media.length > 0) {
    media = raw.media.map((m: any) => ({
      type: m.type || "image",
      url: String(m.url || ""),
    }));
  } else if (raw.thumbnail_url) {
    media = [
      {
        type: "image",
        url: resolveUrl(raw.thumbnail_url),
      },
    ];
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

export default function AllPostsGrid({ hideTitle = false }: { hideTitle?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  useEffect(() => {
    let mounted = true;

    async function fetchPosts() {
      try {
        const token = await getToken().catch(() => null);

        const qs = new URLSearchParams();
        qs.set("status", "all");

        const url = `/api/public/blogs?${qs.toString()}`;

        const res = await fetch(url, {
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

  const getThumbnail = (mediaList?: MediaItem[]) => {
    const fallback = "/logo192.png";
    if (!mediaList || mediaList.length === 0) return fallback;

    const top = mediaList[0];
    if (!top || !top.url) return fallback;

    if (top.type === "image") return top.url;

    if (top.type === "youtube") {
      const url = top.url;
      const videoId =
        url.split("v=")[1]?.split("&")[0] ||
        url.split("/").filter(Boolean).pop();

      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    return fallback;
  };

  const postHref = (post: Post) => (post.slug ? `/blog/${post.slug}` : `/blog/${post.id}`);

  if (loading) return <div className="text-center text-white">Loading...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (posts.length === 0)
    return <div className="text-center text-gray-400">No blog posts found.</div>;

  return (
    <div className="w-full flex justify-center">
      <div className="max-w-6xl w-full px-4">
        {!hideTitle && <h1 className="text-4xl font-bold mb-6 text-center">All Blog Posts</h1>}
        <div className="flex flex-wrap justify-center gap-6">
          {posts.map((post) => {
            const thumbnail = getThumbnail(post.media);
            const key = post.id ?? post.slug ?? Math.random().toString(36);

            return (
              <div
                key={key}
                className="relative bg-gray-800 rounded-lg shadow-lg cursor-pointer transition duration-300 transform hover:scale-105 w-64"
              >
                <Link href={postHref(post)}>
                  <div className="w-full aspect-video overflow-hidden rounded-md">
                    <img
                      src={thumbnail}
                      alt={post.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/logo192.png";
                      }}
                    />
                  </div>
                  <div className="mt-2 text-center p-2">
                    <h2 className="text-lg font-semibold text-white flex items-center justify-center">
                      <span className="truncate max-w-40">{post.title}</span>
                      <StatusBadge status={post.status} />
                    </h2>
                    <p className="text-xs text-gray-400">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
