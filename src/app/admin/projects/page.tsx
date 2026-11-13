import ResourceList from "@/components/admin/management/ResourceList";
import { cmsResourcesAvailable } from "@/lib/db/repositories/cms-resources";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import ProjectsPageClient from "./page.client";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  if (await cmsResourcesAvailable()) {
    const params = await searchParams; const raw = Number(params?.offset ?? 0);
    return <ResourceList section="projects" offset={Number.isSafeInteger(raw) && raw >= 0 && raw <= 1_000_000 ? raw : 0} />;
  }
  return <ProjectsPageClient />;
}
