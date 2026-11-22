import "server-only";

import type { Tables } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

export type Carteira = Tables<"carteiras">;

export async function listarCarteiras(): Promise<Carteira[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("carteiras").select("*").order("nome");
  if (error) throw new Error(`Falha ao listar carteiras: ${error.message}`);
  return data ?? [];
}
