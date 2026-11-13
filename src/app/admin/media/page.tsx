import { mediaMetadataAvailable } from "@/lib/db/repositories/media-metadata";
import Link from "next/link";
import ManagementPage, { Unavailable } from "@/components/admin/management/ManagementPage";
import MediaCatalog from "@/components/admin/management/MediaCatalog";
import { requireManagementOwner } from "@/lib/admin/management";
import { readMediaCatalog } from "@/lib/admin/media-catalog";

export default async function MediaLibrary({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireManagementOwner();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const type = typeof params.type === "string" && ["image", "video", "youtube", "instagram"].includes(params.type) ? params.type : "all";
  const rawOffset = Number(params.offset ?? 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 1_000_000 ? rawOffset : 0;
  const metadataEnabled = await mediaMetadataAvailable();
  const catalog = await readMediaCatalog({ search, type, offset });
  const pageHref = (next: number) => `/admin/media?${new URLSearchParams({ q: search, type, offset: String(next) })}`;
  return <ManagementPage title="Media library" description="Browse real post attachments. Previews use protected local delivery; original storage URLs are not exposed.">
    <form method="get" className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">Search media<input name="q" defaultValue={search} maxLength={200} placeholder="Caption, media title or post title" className="mt-1 block w-full rounded border border-border bg-background p-3" /></label>
      <label>Media type<select name="type" defaultValue={type} className="mt-1 block rounded border border-border bg-background p-3">{["all", "image", "video", "youtube", "instagram"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button className="rounded border border-border px-4 py-3" type="submit">Search</button>
    </form>
    {catalog.available ? <><MediaCatalog items={catalog.items} metadataEnabled={metadataEnabled} /><nav aria-label="Media pages" className="flex flex-wrap gap-4">{offset > 0 && <Link href={pageHref(Math.max(0, offset - 24))} className="underline">Previous</Link>}{catalog.hasMore && <Link href={pageHref(offset + 24)} className="underline">Next</Link>}</nav></> : <Unavailable>The media catalog could not load from the owner repository. Retry the search; no empty library is implied.</Unavailable>}
    <p className="text-sm text-muted-foreground">Catalog coverage: post attachments only. Uploads and featured assignment remain unavailable. Caption/alt editing requires the prepared metadata migration; controls appear only when its owner function is executable. S3 objects have not been changed or reconciled by this page. Existing public S3 objects remain public at their origin.</p>
  </ManagementPage>;
}
