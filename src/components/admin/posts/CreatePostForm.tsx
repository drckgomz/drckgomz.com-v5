// src/components/blog/admin/posts/CreatePostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreatePostForm() {
  const router = useRouter();

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Auto-suggest slug while user hasn’t manually edited it
  const slugTouchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!slugTouchedRef.current) {
      setSlug(slugify(title));
    }
  }, [title]);

  async function onCreate() {
    setErr(null);
    setCreating(true);

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
      };

      if (!payload.title) throw new Error("Title is required.");
      if (!payload.slug) throw new Error("Slug is required.");

      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Create failed (${res.status})`);

      const nextSlug = json?.post?.slug || payload.slug;

      router.push(`/admin/posts/${encodeURIComponent(nextSlug)}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed to create post.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Slug</label>
          <Input
            value={slug}
            onChange={(e) => {
              slugTouchedRef.current = true;
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Excerpt</label>
        <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={4} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={creating}>
          Cancel
        </Button>
        <Button type="button" onClick={onCreate} disabled={creating}>
          {creating ? "Creating…" : "Create & edit"}
        </Button>
      </div>
    </div>
  );
}
