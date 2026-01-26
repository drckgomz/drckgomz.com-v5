// src/app/admin/posts/[slug]/page.tsx
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getAdminPostBySlug } from "@/lib/admin/getAdminPost";
import EditPostForm from "@/components/admin/posts/EditPostForm";
import { Card } from "@/components/ui/card";
import { notFound } from "next/navigation";
import { normalizeAdminPost } from "@/lib/admin/types";

export const metadata = { title: "Edit Post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();

  const { slug } = await params;
  const decoded = decodeURIComponent(slug);

  const initialPostRaw = await getAdminPostBySlug(decoded);
  if (!initialPostRaw) notFound();

  const initialPost = normalizeAdminPost(initialPostRaw);

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-3xl font-bold mb-6">Edit Post</h1>

          <Card className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <EditPostForm initialPost={initialPost} />
          </Card>
        </div>
      </div>
    </main>
  );
}
