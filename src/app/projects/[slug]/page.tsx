// src/app/projects/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/home/NavBar";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";
import { fetchProjectAndMedia } from "@/lib/projects/public";

// ---- Types ----
export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugOrId = slug ?? "";

  if (!slugOrId || slugOrId === "undefined") {
    console.error("[projects/[slug]] invalid slug param", { slug, slugOrId });
    notFound();
  }

  const { project, media } = await fetchProjectAndMedia(slugOrId);

  if (!project) {
    notFound();
  }

  return (
    <div className="w-screen bg-transparent text-white overflow-x-hidden">
      <NavBar />

      <main data-theme-scope="projects" className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-24 pb-16 space-y-8">
        {/* Header / title */}
        <header className="space-y-2">
            {/* Back button — left aligned */}
            <div className="flex">
                <Link
                href="/#projects"
                className="text-xs sm:text-sm text-white/70 hover:text-white inline-flex items-center gap-1"
                >
                ← Back
                </Link>
            </div>

            {/* Title centered */}
            <div className="flex justify-center">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-black/70 px-3 py-1 rounded">
                {project.title}
                </h1>
            </div>
            </header>


        {/* Media carousel */}
        <section className="space-y-4">
          {media && media.length > 0 ? (
            <InlineCarousel media={media} />
          ) : (
            <div className="w-full aspect-video rounded-lg border border-white/10 bg-white/5 grid place-items-center text-sm text-white/70">
              No media yet.
            </div>
          )}

          {/* External link button – centered */}
          {project.href ? (
            <div className="flex justify-center">
              <a
                href={project.href}
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
            </div>
          ) : (
            <p className="text-xs text-white/60 text-center">
              No external link provided for this project.
            </p>
          )}
        </section>

        {/* Content / “blog post” body */}
        <section className="mt-4">
          {project.content ? (
            <article
              className="
                prose prose-invert max-w-none
                prose-headings:text-white 
                prose-p:text-white/90 
                prose-strong:text-white
                prose-a:text-cyan-300 hover:prose-a:text-cyan-200
              "
              dangerouslySetInnerHTML={{ __html: project.content }}
            />
          ) : (
            <p className="text-white/85 text-sm">
              More info about this project coming soon.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
