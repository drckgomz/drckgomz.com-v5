import { resourceEditor } from "@/lib/admin/resource-editor";
import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import ManagementPage, { Unavailable } from "@/components/admin/management/ManagementPage";
import ThemeInspector from "@/components/admin/management/ThemeInspector";
import { requireManagementOwner, readAppearanceStatus, readCanonicalTheme } from "@/lib/admin/management";

export default async function AppearanceManagement() {
  await requireManagementOwner();
  const config = await readPublishedConfiguration();
  const editor = await resourceEditor("appearance", "appearance", config.appearance ?? { light: null, dark: null, font: "system", reading_size: 16, mode: "dark" });
  const [stored, theme] = await Promise.all([readAppearanceStatus(), readCanonicalTheme()]);
  return <ManagementPage title="Appearance" description="Inspect canonical theme tokens and preview the real light and dark palettes.">
    {theme.available ? <ThemeInspector tokens={theme.tokens} /> : <Unavailable>The canonical theme-token source could not be read.</Unavailable>}
    {editor ?? (stored.available ? <section className="space-y-3"><h2 className="text-xl font-semibold">Stored appearance metadata</h2>{stored.rows.length === 0 ? <p>No stored appearance rows.</p> : <ul>{stored.rows.map(row => <li key={row.key}>{row.key}: {row.publication}, version {row.version}</li>)}</ul>}<Unavailable>Stored metadata is not connected to the public renderer. Persistent color/type editing and publication are unavailable.</Unavailable></section> : <Unavailable>{stored.reason}</Unavailable>)}
  </ManagementPage>;
}
