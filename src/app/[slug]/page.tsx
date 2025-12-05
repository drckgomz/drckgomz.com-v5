// src/app/projects/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";

type ProjectRow = {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  href: string | null;
  color: string | null;
  image_url: string | null;
  content: string | null; // HTML, already sanitized when saved
};

type ProjectMediaRow = {
  id: string;
  type: string;
  url: string;
  caption: string | null;
  idx: number | null;
  created_at: string | null;
  meta: any | null;
};

// Try slug first, then fall back to ID
async function fetchProjectAndMedia(slugOrId: string) {
  const supabase = createSupabaseServerClient();

  let project: ProjectRow | null = null;

  // 1) try by slug
  const { data: bySlug, error: slugError } = await supabase
    .from("home_projects") // TODO: change to your real table name if different
    .select(
      "id, slug, title, excerpt, href, color, image_url, content"
    )
    .eq("slug", slugOrId)
    .maybeSingle<ProjectRow>();

  if (slugError) {
    console.error("[ProjectPage] slug lookup error", slugError);
  }

  if (bySlug) {
    project = bySlug;
  } else {
    // 2) fall back to ID
    const { data: byId, error: idError } = await supabase
      .from("home_projects") // TODO: change table name if needed
      .select(
        "id, slug, title, excerpt, href, color, image_url, content"
      )
      .eq("id", slugOrId)
      .maybeSingle<ProjectRow>();

    if (idError) {
      console.error("[ProjectPage] id lookup error", idError);
    }
    project = byId ?? null;
  }

  if (!project) return { project: null, media: [] as ProjectMediaRow[] };

  const { data: mediaRows, error: mediaError } = await supabase
    .from("home_project_media") // TODO: change to your real media table
    .select("id, type, url, caption, idx, created_at, meta")
    .eq("project_id", project.id)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true });

  if (mediaError) {
    console.error("[ProjectPage] media error", mediaError);
  }

  let media = (mediaRows ?? []) as ProjectMediaRow[];

  // If you have a hero image but no media rows, use hero as a fallback slide
  if ((!media || media.length === 0) && project.image_url) {
    media = [
      {
        id: "hero",
        type: "image",
        url: project.image_url,
        caption: project.title,
        idx: 0,
        created_at: null,
        meta: null,
      },
    ];
  }

  return { project, media };
}

export default async function ProjectPage({
  params,
}: {
  params: { slug: string };
}) {
  const slugOrId = decodeURIComponent(params.slug);
  const { project, media } = await fetchProjectAndMedia(slugOrId);

  if (!project) {
    notFound();
  }

  const { title, excerpt, href, content } = project;

  return (
    <main className="min-h-screen w-full bg-black text-white">
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
