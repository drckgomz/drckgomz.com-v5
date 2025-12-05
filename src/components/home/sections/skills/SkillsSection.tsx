// src/components/home/sections/skills/SkillsSection.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SkillsSectionClient from "@/components/home/sections/skills/SkillsSectionClient";

type HomeSectionRow = {
  key: string;
  title: string | null;
  description: string | null;
  body: Record<string, any> | null;
};

export default async function SkillsSection() {
  const supabase = createSupabaseServerClient();

  let title = "Skills";
  let description = "";

  try {
    const { data, error } = await supabase
      .from("home_sections")
      .select("key, title, description, body")
      .eq("key", "skills")
      .maybeSingle<HomeSectionRow>();

    if (error) {
      console.error("[SkillsSection] supabase error", error);
    } else if (data) {
      const bodyDesc =
        data.body && typeof data.body === "object"
          ? (data.body as any).description
          : undefined;

      title = data.title ?? "Skills";
      description = (bodyDesc ?? data.description ?? "").trim();
    }
  } catch (e) {
    console.error("[SkillsSection] unexpected error", e);
  }

  return (
    <SkillsSectionClient
      title={title}
      description={description}
    />
  );
}
