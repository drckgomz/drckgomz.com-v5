import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { privateJson } from "@/lib/auth/response";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return privateJson({ profile: null });
}
