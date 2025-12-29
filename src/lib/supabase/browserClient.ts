// src/lib/supabase/browserClient.ts
"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Backwards-compatible wrapper so old blog code that imports
 * `@/shared/lib/supabase/browserClient` still works.
 */
export const supabase = (() => {
  if (!client) {
    client = getSupabaseBrowserClient();
  }
  return client;
})();
