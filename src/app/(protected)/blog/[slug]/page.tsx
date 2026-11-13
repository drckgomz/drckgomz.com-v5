// src/app/(protected)/blog/[slug]/page.tsx
import BlogView from "@/components/blog/BlogView";
import { isOfflineDesignMode } from "@/lib/offline-design-mode";
import { getOfflineBlogPost } from "@/lib/blog/offline-samples";
import { notFound } from "next/navigation";
import { getReadablePost } from "@/lib/blog/read";

// This is protected by middleware/layout already, so no Clerk checks needed here.
export const revalidate = 0;

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const offlinePreview = isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE });
  if (offlinePreview) {
    const post = getOfflineBlogPost(slug);
    if (!post) notFound();
    return <BlogView slug={slug} offlinePost={post} initialPost={post} />;
  }
  const post = await getReadablePost(slug);
  if (!post) notFound();
  return <BlogView slug={slug} initialPost={post} />;
}
