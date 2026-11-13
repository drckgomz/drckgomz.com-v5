import { resourceEditor } from "@/lib/admin/resource-editor";
import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import Link from "next/link";
import ManagementPage, { Unavailable, ReloadStatus } from "@/components/admin/management/ManagementPage";
import { requireManagementOwner, readAppearanceStatus } from "@/lib/admin/management";
import { publicHero, publicNavigation } from "@/lib/site/public-config";

export default async function HomeManagement() {
  await requireManagementOwner();
  const stored = await readAppearanceStatus();
  const configuration = await readPublishedConfiguration();
  const effective = configuration.homepage ?? { title: publicHero.title, description: "", enabled: true };
  const editor = await resourceEditor("homepage", "homepage", effective);
  return <ManagementPage title="Homepage" description="Review the configuration currently used by the public homepage.">
    <section className="space-y-3 rounded-xl border border-border p-4"><h2 className="text-xl font-semibold">Effective configuration</h2>
      <dl className="space-y-2"><div><dt className="text-muted-foreground">Hero title</dt><dd>{effective.title}</dd></div><div><dt className="text-muted-foreground">Hero video sources</dt><dd>{publicHero.video_sources.length === 0 ? "None configured; the static fallback is active." : publicHero.video_sources.length}</dd></div><div><dt className="text-muted-foreground">Public navigation links</dt><dd>{publicNavigation.length}</dd></div></dl>
      <Link href="/" className="inline-block underline">Preview public homepage</Link>
    </section>
    {editor ?? <Unavailable>{stored.available ? "Stored appearance metadata is readable, but homepage editing and publication are not wired to the public renderer. Effective configuration remains source-defined." : stored.reason}</Unavailable>}
    <ReloadStatus />
  </ManagementPage>;
}
