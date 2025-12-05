// src/components/home/sections/about/AboutSection.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import AboutSectionClient from "@/components/home/sections/about/AboutSectionClient";

type Section = {
  title?: string | null;
  description?: string | null;
  body?: any | null;
};

type Media = {
  id: string;
  type: string;
  caption?: string | null;
  original: string;   // raw/original location
  w800?: string;      // small derivative
  w1600?: string;     // large derivative
};

const MEDIA_BASE = process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "";
const LEGACY_BASES: RegExp[] = [
  /^https:\/\/s3\.us-east-1\.amazonaws\.com\/www\.drckgomz\.com/i,
  /^https:\/\/www\.drckgomz\.com\.s3\.amazonaws\.com/i,
];

// Normalize any legacy base to the current MEDIA_BASE
function normalizeBase(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let out = url;
  for (const rx of LEGACY_BASES) {
    out = out.replace(rx, MEDIA_BASE);
  }
  return out;
}

// /standard/about/<tail>.w###.webp  ->  /about/<tail>
function toOriginalFromDerivative(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  if (!/\/standard\/about\//.test(u)) return u;
  return u.replace("/standard/about/", "/about/").replace(/\.w\d+\.webp$/, "");
}

// /about/<tail>  ->  <MEDIA_BASE>/standard/about/<tail>.w###.webp
function toDerivativeAbout(
  u: string | null | undefined,
  size: "w800" | "w1600" = "w1600"
): string | undefined {
  if (!u) return undefined;
  if (/\/standard\/about\//.test(u)) {
    return u.replace(/\.w\d+\.webp$/, `.${size}.webp`);
  }
  if (!/\/about\//.test(u)) return u;
  if (!MEDIA_BASE) return u;
  const tail = u.split("/about/")[1];
  return `${MEDIA_BASE}/standard/about/${tail}.${size}.webp`;
}


async function fetchAboutData() {
  const supabase = createSupabaseServerClient();

  // --- Section row ---
  const { data: sectionRow, error: sectionError } = await supabase
    .from("home_sections")
    .select("*")
    .eq("key", "about")
    .maybeSingle();

  if (sectionError) {
    console.error("[About] section error", sectionError);
  }

  let description: string | null = sectionRow?.description ?? null;

  if (!description && sectionRow?.body) {
    try {
      // handle weird double-encoded JSON if present
      const rawBody = typeof sectionRow.body === "string"
        ? JSON.parse(sectionRow.body)
        : sectionRow.body;

      if (rawBody && typeof rawBody === "object" && rawBody.description) {
        description = String(rawBody.description);
      }
    } catch {
      // ignore parse error, fall back to null
    }
  }

  const section: Section = {
    title: sectionRow?.title ?? "About",
    description,
    body: sectionRow?.body ?? null,
  };

  // --- Media rows ---
  const { data: mediaRows, error: mediaError } = await supabase
    .from("home_media")
    .select("*")
    .eq("section_key", "about")
    .order("idx", { ascending: true });

  if (mediaError) {
    console.error("[About] media error", mediaError);
  }

  const media: Media[] =
    mediaRows?.map((m: any) => {
      const normalized = normalizeBase(m.url) ?? m.url;
      const original = toOriginalFromDerivative(normalized) ?? normalized;

      return {
        id: m.id,
        type: m.type,
        caption: m.caption,
        original,
        w800: toDerivativeAbout(original, "w800"),
        w1600: toDerivativeAbout(original, "w1600"),
      };
    }) ?? [];

  return { section, media };
}

export default async function AboutSection() {
  const { section, media } = await fetchAboutData();

  return (
    <Suspense fallback={null}>
      <AboutSectionClient section={section} media={media} />
    </Suspense>
  );
}
