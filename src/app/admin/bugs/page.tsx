import ManagementPage, { Unavailable, ReloadStatus } from "@/components/admin/management/ManagementPage";
import { requireManagementOwner, readBugBackend } from "@/lib/admin/management";

export default async function BugManagement() {
  await requireManagementOwner();
  const backend = await readBugBackend();
  return <ManagementPage title="Bug reports" description="Check whether a real report inbox is available for review and triage.">
    <Unavailable>{backend.reason}</Unavailable><ReloadStatus />
  </ManagementPage>;
}
