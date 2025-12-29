// src/components/blog/admin/ManagePostForm/ManagePostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { usePostEditor } from "./usePostEditor";
import { useSlugInput } from "./useSlug";

type Mode = "create" | "edit";

export default function ManagePostForm({
  initialPost,
  mode = "create",
}: {
  initialPost?: any;
  mode?: Mode;
}) {
  const router = useRouter();
  const { getToken } = useAuth();

  const { title, setTitle, slug, setSlug, content, setContent, submitPayload } =
    usePostEditor(initialPost, mode);

  const slugHandlers = useSlugInput(slug, setSlug);

  // IMPORTANT: v5 should hit Next routes (same-origin), NOT API_BASE / localhost:3001
  // Implement these routes server-side in Next (recommended) or proxy them.
  const handleSubmit = async () => {
    const payload = submitPayload();
    if (!payload.title.trim() || !payload.slug.trim()) {
      alert("Title and slug are required.");
      return;
    }

    const token = await getToken().catch(() => null);
    if (!token) {
      alert("You must be signed in as admin.");
      return;
    }

    const res = await fetch("/api/admin/posts/upsert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: JSON.stringify({
        mode,
        originalSlug: initialPost?.slug ?? null,
        ...payload,
      }),
    });

    const text = await res.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {}

    if (!res.ok) {
      console.error("[ManagePostForm] save failed", res.status, json || text);
      alert(json?.error || "Save failed");
      return;
    }

    const nextSlug = json?.post?.slug ?? payload.slug;
    router.push(`/blog/${nextSlug}`);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="grid gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              autoComplete="off"
              className="bg-background/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-slug">Slug</Label>
            <Input
              id="post-slug"
              value={slug}
              onChange={(e) => slugHandlers.onChange(e.target.value)}
              onBlur={slugHandlers.onBlur}
              onKeyDown={slugHandlers.onKeyDown}
              placeholder="my-post-slug"
              autoComplete="off"
              className="bg-background/40 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              URL: <span className="font-mono">/blog/{slug || "your-slug"}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-content">Content</Label>
          {/* Keep simple for now — you can swap for your Editor later */}
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[320px] w-full rounded-md border border-border bg-background/40 p-3 text-sm"
            placeholder="Write your post..."
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            ← Back
          </Button>

          <Button type="submit">
            {mode === "edit" ? "Save changes" : "Create post"}
          </Button>
        </div>
      </form>
    </div>
  );
}
