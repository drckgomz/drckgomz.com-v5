import ManagementPage, { Unavailable, ReloadStatus } from "@/components/admin/management/ManagementPage";
import { readPrivateAccessAvailability } from "@/lib/admin/management";
import { notFound, redirect } from "next/navigation";
import { OwnerPrivateAccessDashboard } from "@/components/admin/OwnerPrivateAccessDashboard";
import { getBackendConfiguration } from "@/lib/backend-configuration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateAccessPage() {
  if (getBackendConfiguration().auth !== "better-auth") redirect("/blog");
  const { getViewer } = await import("@/lib/auth/viewer");
  const { userId, profile } = await getViewer();
  if (!userId) redirect("/sign-in?redirect_url=/admin/private-access");
  if (profile?.is_banned) redirect("/banned");
  if (!profile?.enabled || profile.is_owner !== true) notFound();
  if (!await readPrivateAccessAvailability()) {
    return <ManagementPage title="Private journal access" description="Manage access only through the reviewed owner-authorized database functions.">
      <Unavailable>The Private Access management functions are missing, not executable, or their readiness check failed. No audience list has been loaded and no permissions have been changed.</Unavailable>
      <ReloadStatus />
    </ManagementPage>;
  }
  return <OwnerPrivateAccessDashboard />;
}
