import { resourceEditor } from "@/lib/admin/resource-editor";
import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import Link from "next/link";
import ManagementPage, { Unavailable } from "@/components/admin/management/ManagementPage";
import { requireManagementOwner } from "@/lib/admin/management";
import { publicNavigation } from "@/lib/site/public-config";

export default async function NavigationManagement() {
  await requireManagementOwner();
  const config = await readPublishedConfiguration();
  const items = config.navigation?.items ?? publicNavigation;
  const editor = await resourceEditor("navigation", "navigation", { items: [...items] });
  return <ManagementPage title="Public navigation" description="Review the effective link labels, order, and destinations shared with the public navigation renderer.">
    <ol className="space-y-3">{items.map((item, index) => <li key={item.href} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><span>{index + 1}. {item.label}</span><Link href={item.href} className="break-all underline underline-offset-4">{item.href}</Link></li>)}</ol>
    {editor ?? <Unavailable>Navigation persistence and editing are not installed. This list is the effective public configuration, not saved draft data. Admin access remains independent of these public links.</Unavailable>}
  </ManagementPage>;
}
