// src/app/admin/posts/[slug]/page.tsx
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getAdminPostBySlug } from "@/lib/admin/getAdminPost";
import ManagePostForm from "@/features/blog/components/admin/ManagePostForm";
import { Card } from "@/components/ui/card";
import { notFound } from "next/navigation";

export const metadata = { title: "Edit Post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();

  const { slug } = await params; // ✅ Next 16 params is Promise
  const decoded = decodeURIComponent(slug);

  const initialPost = await getAdminPostBySlug(decoded);
  if (!initialPost) notFound();

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-3xl font-bold mb-6">Edit Post</h1>

          <Card className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <ManagePostForm initialPost={initialPost} mode="edit" />
          </Card>
        </div>
      </div>
    </main>
  );
}
