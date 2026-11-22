import "server-only";

import type { Tables } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

export type Escritorio = Tables<"escritorio">;

/** Linha única do cadastro do escritório. */
export async function obterEscritorio(): Promise<Escritorio> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("escritorio").select("*").limit(1).single();
  if (error || !data) throw new Error(`Cadastro do escritório não encontrado: ${error?.message ?? "vazio"}`);
  return data;
}
