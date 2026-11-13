export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireAdmin } from "@/lib/admin/requireAdmin";
import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
