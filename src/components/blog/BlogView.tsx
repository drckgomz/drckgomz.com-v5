// frontend/src/features/blog/components/BlogView.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";

import NavBar from "@/components/blog/Navbar";
import BlogContent from "./BlogContent";
import MediaCarousel from "./MediaCarousel";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type MediaItem = {
  id: string;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null;
  title?: string | null;
};

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  status?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  thumbnail_url?: string | null;
  media?: MediaItem[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // e.g. http://localhost:3001

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

export default function BlogView({ slug }: { slug: string }) {
  const router = useRouter();
  const { isSignedIn, getToken } = useAuth();

  const [post, setPost] = React.useState<Post | null>(null);
  const [mediaList, setMediaList] = React.useState<MediaItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let abort = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = `${API_BASE}/v1/public/blogs/${encodeURIComponent(slug)}`;
        const token = isSignedIn ? await getToken() : null;

        // try with viewer token first so private posts are returned if allowed
        let res = await fetch(url, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        // if token rejected, fall back to anonymous → public only
        if (!res.ok && token && (res.status === 401 || res.status === 403)) {
          res = await fetch(url, { cache: "no-store" });
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`API ${res.status} ${txt}`);
        }

        const data = await res.json();
        const p: Post = data?.post ?? data;

        if (abort) return;

        setPost(p);

        const m = Array.isArray(p?.media) ? p.media : [];
        const normalized = m.map((x) => ({
          id: x.id,
          type: x.type,
          url: x.url,
          caption: x.caption ?? x.title ?? null,
          title: x.title ?? null,
        }));
        setMediaList(normalized);
      } catch (e: any) {
        if (!abort) setError(e?.message || "Error loading post");
      } finally {
        if (!abort) setLoading(false);
      }
    };

    load();
    return () => {
      abort = true;
    };
  }, [slug, isSignedIn, getToken]);

  // Simple loading / error states outside Clerk gating
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <NavBar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <NavBar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-sm text-destructive">{error}</p>
          <div className="flex justify-center mt-6">
            <Button variant="outline" onClick={() => router.push("/blog")}>
              ← Back to blog
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <NavBar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-sm text-muted-foreground">
            Post not found.
          </p>
          <div className="flex justify-center mt-6">
            <Button variant="outline" onClick={() => router.push("/blog")}>
              ← Back to blog
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const created =
    post.created_at || post.date
      ? new Date(post.created_at || (post.date as string))
      : null;
  const updated = post.updated_at ? new Date(post.updated_at) : null;

  return (
    <>
      <SignedOut>
        <RedirectToSignIn redirectUrl={`/blog/${post.slug}`} />
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen bg-background text-foreground">
          <NavBar />

          <main className="container mx-auto px-4 pt-24 pb-12">
            {mediaList.length > 0 && (
              <div className="mb-10">
                <MediaCarousel media={mediaList} />
              </div>
            )}

            <Card className="border-border bg-background/70 backdrop-blur">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl sm:text-3xl font-semibold">
                      {post.title}
                    </CardTitle>
                    {post.excerpt && (
                      <CardDescription className="text-sm text-muted-foreground">
                        {post.excerpt}
                      </CardDescription>
                    )}
                  </div>

                  {post.status && (
                    <Badge
                      variant={statusVariant(post.status)}
                      className="uppercase text-[10px] tracking-wide"
                    >
                      {statusLabel(post.status)}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  {created && (
                    <span>Created: {created.toLocaleDateString()}</span>
                  )}
                  {updated &&
                    !Number.isNaN(updated.valueOf()) &&
                    (!created || updated.getTime() !== created.getTime()) && (
                      <>
                        <span>•</span>
                        <span>Updated: {updated.toLocaleDateString()}</span>
                      </>
                    )}
                </div>
              </CardHeader>

              <Separator className="bg-border/70" />

              <CardContent className="pt-6">
                <BlogContent content={post.content || ""} media={mediaList} />
              </CardContent>
            </Card>

            <div className="flex justify-center pt-10">
              <Button asChild variant="outline" className="px-6">
                <Link href="/blog">← Back to blog</Link>
              </Button>
            </div>
          </main>
        </div>
      </SignedIn>
    </>
  );
}
