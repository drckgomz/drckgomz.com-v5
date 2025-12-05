// src/components/home/sections/contact/ContactSection.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ContactSectionClient from "./ContactSectionClient";

type ContactSectionRow = {
  key: string;
  title: string | null;
  description: string | null;
  body: Record<string, any> | null;
};

const DEFAULT_EMAIL = "drckgomz@gmail.com";

export default async function ContactSection() {
  const supabase = createSupabaseServerClient();

  let toEmail = DEFAULT_EMAIL;

  try {
    const { data, error } = await supabase
      .from("home_sections")
      .select("key, title, description, body")
      .eq("key", "contact")
      .maybeSingle<ContactSectionRow>();

    if (error) {
      console.error("[ContactSection] supabase error", error);
    } else if (data) {
      const emailFromBody =
        data.body && typeof data.body === "object"
          ? (data.body as any).email
          : undefined;

      const emailFromDescription =
        typeof data.description === "string" ? data.description : undefined;

      toEmail = emailFromBody ?? emailFromDescription ?? DEFAULT_EMAIL;
    }
  } catch (e) {
    console.error("[ContactSection] unexpected error", e);
  }

  return <ContactSectionClient toEmail={toEmail} />;
}
