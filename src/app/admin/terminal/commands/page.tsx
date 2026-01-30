// src/app/admin/terminal/commands/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import ManageTerminalCommandsPageClient from "@/app/admin/terminal/commands/page.client";

export default function Page() {
  return <ManageTerminalCommandsPageClient />;
}
