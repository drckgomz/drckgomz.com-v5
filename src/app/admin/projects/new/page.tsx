import { randomUUID } from "crypto";
import { resourceEditor, projectDefaults } from "@/lib/admin/resource-editor";
import ManagementPage, { Unavailable } from "@/components/admin/management/ManagementPage";
import { requireManagementOwner } from "@/lib/admin/management";

export default async function NewProject() {
  await requireManagementOwner();
  const editor = await resourceEditor("projects", randomUUID(), projectDefaults, true);
  return <ManagementPage title="Create project" description="Project creation requires a transactional owner repository.">
    {editor ?? <Unavailable>Project creation is not installed. No project has been created. The existing project API supports legacy reads only and is disabled in this runtime.</Unavailable>}
  </ManagementPage>;
}
