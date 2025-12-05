// src/components/home/sections/hero/HeroSection.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import HeroSectionClient from "./HeroSectionClient";

type HeroCrop = { x: number; y: number; zoom: number };

type HomeSection = {
  key: string;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  body?: Record<string, any> | null;
};

export default async function HeroSection() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("home_sections")
    .select("*")
    .eq("key", "hero")
    .maybeSingle<HomeSection>();

  if (error) {
    console.error("[HeroSection] supabase error", error);
  }

  const body = (data?.body || {}) as Record<string, any>;

  const crop: HeroCrop = {
    x: Math.max(0, Math.min(100, Number(body?.heroCrop?.x ?? 50))),
    y: Math.max(0, Math.min(100, Number(body?.heroCrop?.y ?? 50))),
    zoom: Math.max(1, Math.min(3, Number(body?.heroCrop?.zoom ?? 1))),
  };

  const hero = {
    title: data?.title ?? undefined,
    description:
      (data?.description as string | undefined) ??
      (typeof data?.body === "object"
        ? (data?.body as any)?.description
        : undefined),
    thumbnail_url: data?.thumbnail_url ?? undefined,
    crop,
  };

  return <HeroSectionClient hero={hero} />;
}
