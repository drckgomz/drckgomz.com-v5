// src/app/projects/[slug]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/home/NavBar";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---- Types ----
type ProjectRow = {
  id: string;
  idx: number;
  title: string;
  slug: string | null;
  excerpt: string | null;
  href: string | null;
  color: string | null;
  image_url: string | null;
  content: string | null;
  status: string | null;
};

type MediaRow = {
  id: string;
  type: string;
  url: string;
  caption?: string | null;
  idx?: number | null;
  meta?: any;
  created_at?: string;
};

// ---- URL normalization (same idea as your API) ----
const LEGACY_BASES = [
  /^https:\/\/s3\.us-east-1\.amazonaws\.com\/www\.drckgomz\.com/i,
  /^https:\/\/www\.drckgomz\.com\.s3\.amazonaws\.com/i,
];

const MEDIA_BASE = process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "";

function normalizeMediaUrl(url: string | null): string | null {
  if (!url) return null;
  let out = url;

  if (MEDIA_BASE) {
    for (const rx of LEGACY_BASES) {
      out = out.replace(rx, MEDIA_BASE);
    }
  }

  return out;
}

// Only treat as UUID if it *looks* like a UUID
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchProjectAndMedia(slugOrId: string) {
  const supabase = createSupabaseServerClient();

  let project: ProjectRow | null = null;
  let error: any = null;

  // 1) try by slug
  {
    const { data, error: err } = await supabase
      .from("home_projects")
      .select(
        "id, idx, title, slug, excerpt, href, color, image_url, content, status"
      )
      .eq("slug", slugOrId)
      .maybeSingle<ProjectRow>();

    project = data ?? null;
    error = err ?? null;
  }

  // 2) if not found & slugOrId looks like a UUID, try by id
  if (!project && !error && UUID_RE.test(slugOrId)) {
    const { data: byId, error: errById } = await supabase
      .from("home_projects")
      .select(
        "id, idx, title, slug, excerpt, href, color, image_url, content, status"
      )
      .eq("id", slugOrId)
      .maybeSingle<ProjectRow>();

    project = byId ?? null;
    error = errById ?? null;
  }

  if (error) {
    console.error("[projects/[slug]] project fetch error", error ?? "[no error]");
  }

  if (!project) return { project: null, media: [] as MediaRow[] };

  const { data: mediaRows, error: mediaError } = await supabase
    .from("home_project_media")
    .select("id, type, url, caption, idx, meta, created_at")
    .eq("project_id", project.id)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true });

  if (mediaError) {
    console.error("[projects/[slug]] media fetch error", mediaError ?? "[no error]");
  }

  let media: MediaRow[] = Array.isArray(mediaRows) ? mediaRows : [];

  // Fallback: if no media rows but we have image_url, use it as a single image media
  const heroUrl = normalizeMediaUrl(project.image_url);
  if ((!media || media.length === 0) && heroUrl) {
    media = [
      {
        id: "hero",
        type: "image",
        url: heroUrl,
        caption: project.title ?? "",
        idx: 0,
      },
    ];
  } else {
    media = media.map((m) => ({
      ...m,
      url: normalizeMediaUrl(m.url) || m.url,
    }));
  }

  project.image_url = heroUrl;

  return { project, media };
}

export const revalidate = 0;

// Next 16: params is a Promise
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugOrId = decodeURIComponent(slug ?? "");

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

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-24 pb-16 space-y-8">
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
