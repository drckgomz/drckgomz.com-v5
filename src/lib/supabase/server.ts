// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server client"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });
}
