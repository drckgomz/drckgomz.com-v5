// src/components/blog/admin/posts/usePosts.ts
"use client";

import * as React from "react";
import type { Post, Tab } from "./types";
import { useAuth } from "@clerk/nextjs";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || ""; 
// If empty => use same-origin /api routes

function apiUrl(path: string) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

export function usePosts() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("all");
  const [q, setQ] = React.useState("");

  const { getToken } = useAuth();

  const fetchPosts = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Missing auth token");

      const qs = new URLSearchParams();
      if (tab && tab !== "all") qs.set("status", tab);

      const url = apiUrl(
        `/api/admin/posts${qs.toString() ? `?${qs.toString()}` : ""}`
      );

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load posts (${res.status}): ${txt.slice(0, 300)}`);
      }

      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.posts) ? json.posts : Array.isArray(json) ? json : [];
      setPosts(list);
    } catch (e: any) {
      console.error("[usePosts] fetch error", e);
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }, [tab, getToken]);

  React.useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered = React.useMemo(() => {
    let list = posts;
    if (tab !== "all") list = list.filter((p) => p.status === tab);

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(s) ||
          (p.slug || "").toLowerCase().includes(s) ||
          (p.excerpt || "").toLowerCase().includes(s)
      );
    }

    return list;
  }, [posts, tab, q]);

  const patch = React.useCallback(
    async (slug: string, body: Record<string, any>) => {
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");

        const url = apiUrl(`/api/admin/posts/${encodeURIComponent(slug)}`);

        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to update post (${res.status}): ${txt.slice(0, 300)}`);
        }

        await fetchPosts();
      } catch (e: any) {
        console.error("[ManagePosts] patch:error", e);
        setError(e?.message || "Failed to update post");
        alert("Failed to update post");
      }
    },
    [fetchPosts, getToken]
  );

  const del = React.useCallback(
    async (slug: string) => {
      if (!confirm(`Delete post "${slug}"? This cannot be undone.`)) return;

      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new Error("Missing auth token");

        const url = apiUrl(`/api/admin/posts/${encodeURIComponent(slug)}`);

        const res = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to delete post (${res.status}): ${txt.slice(0, 300)}`);
        }

        setPosts((prev) => prev.filter((p) => p.slug !== slug));
      } catch (e: any) {
        console.error("[ManagePosts] delete:error", e);
        setError(e?.message || "Failed to delete post");
        alert("Failed to delete post");
      }
    },
    [getToken]
  );

  return {
    posts,
    filtered,
    loading,
    error,
    tab,
    setTab,
    q,
    setQ,
    fetchPosts,
    del,
    makePublic: (slug: string) => patch(slug, { status: "public" }),
    makePrivate: (slug: string) => patch(slug, { status: "private" }),
    makeDraft: (slug: string) => patch(slug, { status: "draft" }),
    archive: (slug: string) => patch(slug, { status: "archived" }),
    unarchive: (slug: string) => patch(slug, { status: "draft" }),
  };
}
