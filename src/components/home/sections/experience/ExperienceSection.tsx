// src/components/home/sections/experience/ExperienceSection.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ExperienceSectionClient from "@/components/home/sections/experience/ExperienceSectionClient";

type HomeSectionRow = {
  key: string;
  title: string | null;
  description: string | null;
  body: Record<string, any> | null;
};

export default async function ExperienceSection() {
  const supabase = createSupabaseServerClient();

  let title = "Experience";
  let description = "";

  try {
    const { data, error } = await supabase
      .from("home_sections")
      .select("key, title, description, body")
      .eq("key", "experience")
      .maybeSingle<HomeSectionRow>();

    if (error) {
      console.error("[ExperienceSection] supabase error", error);
    } else if (data) {
      const bodyDesc =
        data.body && typeof data.body === "object"
          ? (data.body as any).description
          : undefined;

      title = data.title ?? "Experience";
      description = (bodyDesc ?? data.description ?? "").trim();
    }
  } catch (e) {
    console.error("[ExperienceSection] unexpected error", e);
  }

  return (
    <ExperienceSectionClient
      title={title}
      description={description}
    />
  );
}
