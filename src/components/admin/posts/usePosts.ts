"use client";
import * as React from "react";
import type { Post, Tab } from "./types";

export function usePosts() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("all");
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [pendingSlug, setPendingSlug] = React.useState<string | null>(null);
  const mutationPending = React.useRef(false);
  const requestRef = React.useRef<AbortController | null>(null);

  const fetchPosts = React.useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ limit: "25", offset: String(page * 25) });
      if (q.trim()) query.set("q", q.trim());
      if (tab !== "all") query.set("status", tab);
      const res = await fetch(`/api/admin/posts?${query}`, { cache: "no-store", signal: controller.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to load posts.");
      if (!controller.signal.aborted) { setPosts(Array.isArray(json.posts) ? json.posts : []); setHasMore(json.hasMore === true); }
    } catch (e) {
      if (!controller.signal.aborted) { setPosts([]); setHasMore(false); setError(e instanceof Error ? e.message : "Unable to load posts."); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [tab, page, q]);

  React.useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void fetchPosts(); });
    return () => { active = false; requestRef.current?.abort(); };
  }, [fetchPosts]);
  const filtered = posts;

  const patch = async (slug: string, status: Post["status"]) => {
    if (mutationPending.current) return;
    const post = posts.find(item => item.slug === slug);
    if (!post) { setError("Reload the post list before changing status."); return; }
    if (status === "public" && post.status !== "public" && !window.confirm("Publish this post publicly?")) return;
    mutationPending.current = true;
    setPendingSlug(slug); setError(null);
    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expected_revision: post.revision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to change post status.");
      await fetchPosts();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to change post status."); }
    finally { mutationPending.current = false; setPendingSlug(null); }
  };
  const del = async (slug: string) => {
    if (mutationPending.current || !window.confirm("Permanently delete this post? Posts with linked media or other references cannot be deleted.")) return;
    mutationPending.current = true;
    setPendingSlug(slug); setError(null);
    try {
      const post = posts.find(item => item.slug === slug);
      if (!post?.revision) throw new Error("Reload the post list before deleting it.");
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: post.revision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to delete post.");
      await fetchPosts();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete post."); }
    finally { mutationPending.current = false; setPendingSlug(null); }
  };
  const duplicate = async (slug: string): Promise<string | null> => {
    if (mutationPending.current || !window.confirm("Create a private text-only draft copy? Original content and media remain unchanged.")) return null;
    const post=posts.find(item=>item.slug===slug);if(!post?.revision)return null;
    mutationPending.current=true;setPendingSlug(slug);setError(null);
    try {const response=await fetch(`/api/admin/posts/${encodeURIComponent(slug)}/duplicate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expected_revision:post.revision})});const json=await response.json();if(!response.ok)throw new Error(json.error||"Duplicate failed.");await fetchPosts();return typeof json.post?.slug==="string"?json.post.slug:null;}
    catch(cause){setError(cause instanceof Error?cause.message:"Duplicate failed.");return null;}
    finally{mutationPending.current=false;setPendingSlug(null);}
  };
  return { posts, filtered, loading, error, tab, setTab: (value: Tab) => { setPage(0); setQ(""); setTab(value); }, q, setQ: (value: string) => { setPage(0); setQ(value); }, fetchPosts, del, duplicate, pendingSlug, page, setPage, hasMore,
    makePublic: (slug: string) => patch(slug, "public"), makePrivate: (slug: string) => patch(slug, "private"),
    makeDraft: (slug: string) => patch(slug, "draft"), archive: (slug: string) => patch(slug, "archived"), unarchive: (slug: string) => patch(slug, "draft") };
}
