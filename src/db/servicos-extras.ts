import "server-only";

import type { Tables } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

export type ServicoExtra = Tables<"servicos_extras">;

export async function listarServicosExtras(filtro: { ativos?: boolean } = {}): Promise<ServicoExtra[]> {
  const supabase = await createServerClient();
  let q = supabase.from("servicos_extras").select("*").order("nome");
  if (filtro.ativos !== undefined) q = q.eq("ativo", filtro.ativos);
  const { data, error } = await q;
  if (error) throw new Error(`Falha ao listar serviços extras: ${error.message}`);
  return data ?? [];
}
