// src/app/admin/posts/new/page.tsx
import { requireAdmin } from "@/lib/admin/requireAdmin";
import ManagePostForm from "@/components/blog/admin/posts/ManagePostForm";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Create Post" };

export default async function NewPostPage() {
  await requireAdmin();

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-3xl font-bold mb-6">Create Post</h1>

          <Card className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <ManagePostForm initialPost={null} mode="new" />
          </Card>
        </div>
      </div>
    </main>
  );
}
