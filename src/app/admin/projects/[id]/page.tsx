// src/app/admin/projects/[id]/page.tsx
import { requireAdmin } from "@/lib/admin/requireAdmin";
import ProjectEditorPageClient from "./project-editor-page-client";

export default async function AdminProjectEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await props.params;
  return <ProjectEditorPageClient id={id} />;
}
