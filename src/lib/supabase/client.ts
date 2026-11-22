import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

import type { Database } from "@/db/database.types";

/** Cliente Supabase para Client Components (navegador). Respeita RLS. */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar configuradas.",
    );
  }
  return createSsrBrowserClient<Database>(url, chave);
}
