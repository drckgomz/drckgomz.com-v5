import Image from "next/image";
import Link from "next/link";
import { fetchPublicProjects } from "@/lib/projects/public";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 12;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const requested = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(10_000, Math.max(1, requested)) : 1;
  const { items: visible, hasMore } = await fetchPublicProjects(PAGE_SIZE, (page - 1) * PAGE_SIZE);

  return (
    <main className="min-h-dvh bg-[#090a0b] px-5 pb-20 text-white sm:px-8">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/15 py-6">
        <Link href="/" className="font-display text-xl tracking-wide text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">drckgomz</Link>
        <h1 className="font-display text-2xl sm:text-4xl">Projects</h1>
        <Link href="/settings" aria-label="Account" className="grid size-10 place-items-center rounded-full border border-white/30 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">DG</Link>
      </header>
      <section className="mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Project gallery">
        {visible.map((project) => {
          const href = `/projects/${encodeURIComponent(project.slug || project.id)}`;
          return (
            <Link key={project.id} href={href} className="group overflow-hidden rounded-md border border-white/15 bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
                {project.image_url ? <Image src={project.image_url} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" /> : <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" aria-hidden="true" />}
              </div>
              <div className="p-5">
                <h2 className="font-display text-xl">{project.title}</h2>
                {project.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/70">{project.excerpt}</p> : null}
              </div>
            </Link>
          );
        })}
      </section>
      {visible.length === 0 ? <p className="mx-auto mt-16 max-w-xl text-center text-white/70">No published projects are available yet.</p> : null}
      {page > 1 || hasMore ? (
        <nav aria-label="Project pages" className="mx-auto mt-10 flex max-w-7xl justify-center gap-3">
          {page > 1 ? <Link href={`/projects?page=${page - 1}`} className="rounded border border-white/25 px-4 py-2">Previous</Link> : null}
          <span aria-current="page" className="px-3 py-2">Page {page}</span>
          {hasMore ? <Link href={`/projects?page=${page + 1}`} className="rounded border border-white/25 px-4 py-2">Next</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
