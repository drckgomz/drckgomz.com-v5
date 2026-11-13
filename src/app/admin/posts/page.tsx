import { requireAdmin } from "@/lib/admin/requireAdmin";
// src/app/admin/posts/page.tsx
import ManagePostsPage from "@/components/admin/posts/ManagePostsPage";

export default async function Page() {
  await requireAdmin();
  return <ManagePostsPage />;
}
