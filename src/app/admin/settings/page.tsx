import { resourceEditor } from "@/lib/admin/resource-editor";
import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import Link from "next/link";
import ManagementPage, { Unavailable } from "@/components/admin/management/ManagementPage";
import { requireManagementOwner } from "@/lib/admin/management";
import { publicSiteMetadata } from "@/lib/site/public-config";

export default async function SiteSettings() {
  const owner = await requireManagementOwner();
  const config = await readPublishedConfiguration();
  const effective = config.settings ?? { ...publicSiteMetadata, profile_name: owner.display_name || "", bio: "", social_links: [] };
  const editor = await resourceEditor("settings", "settings", effective);
  return <ManagementPage title="Site settings" description="Review effective public metadata and your current public account profile.">
    <section className="space-y-3 rounded-xl border border-border p-4"><h2 className="text-xl font-semibold">Effective metadata</h2><dl className="space-y-3"><div><dt className="text-muted-foreground">Website title</dt><dd>{effective.title}</dd></div><div><dt className="text-muted-foreground">Description</dt><dd>{effective.description}</dd></div><div><dt className="text-muted-foreground">Your display name</dt><dd>{owner.display_name || "Not configured"}</dd></div></dl><Link href="/account" className="inline-block underline">Edit your account profile</Link></section>
    {editor ?? <Unavailable>Global metadata, branding, social links and SEO settings do not yet have a persistence repository. The values above come from the same public configuration as the site. Account profile editing is available separately.</Unavailable>}
  </ManagementPage>;
}
