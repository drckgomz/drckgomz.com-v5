// src/app/(protected)/blog/[slug]/page.tsx
import BlogView from "@/components/blog/BlogView";

// This is protected by middleware/layout already, so no Clerk checks needed here.
export const revalidate = 0;

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return <BlogView slug={slug} />;
}