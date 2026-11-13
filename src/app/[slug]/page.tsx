// src/app/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProjectAndMedia } from "@/lib/projects/public";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugOrId = slug;
  const { project, media } = await fetchProjectAndMedia(slugOrId);

  if (!project) {
    notFound();
  }

  const { title, excerpt, href, content } = project;

  return (
    <main data-theme-scope="projects" className="min-h-screen w-full bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-28">
        {/* Back link */}
        <div className="mb-4 text-sm text-white/70">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-1 text-white/80 hover:text-white"
          >
            ← Back to projects
          </Link>
        </div>

        {/* Title + excerpt */}
        <header className="space-y-2 mb-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            {title}
          </h1>
          {excerpt ? (
            <p className="text-base sm:text-lg text-white/80 max-w-2xl">
              {excerpt}
            </p>
          ) : null}
        </header>

        {/* Media carousel */}
        <section className="mb-6">
          {media?.length ? (
            <InlineCarousel media={media} />
          ) : (
            <div className="w-full aspect-video rounded-lg border border-white/10 bg-white/5 grid place-items-center text-white/70 text-sm">
              No media yet.
            </div>
          )}
        </section>

        {/* External link */}
        <section className="mb-8">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex items-center gap-2
                px-4 py-2 rounded-md
                bg-cyan-500 hover:bg-cyan-400
                text-black font-semibold
                ring-1 ring-black/10
                transition-colors
              "
            >
              Visit project ↗
            </a>
          ) : (
            <p className="text-xs text-white/60">
              No external link provided for this project.
            </p>
          )}
        </section>

        {/* Long content – treat like a blog post */}
        <article
          className="
            prose prose-invert max-w-none
            prose-headings:text-white 
            prose-p:text-white/90 
            prose-strong:text-white
            prose-a:text-cyan-300 hover:prose-a:text-cyan-200
          "
        >
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="text-sm text-white/80">
              More details coming soon. Check back later!
            </p>
          )}
        </article>
      </div>
    </main>
  );
}
