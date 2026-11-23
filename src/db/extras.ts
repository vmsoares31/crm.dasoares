import "server-only";

import type { Tables } from "@/db/database.types";
import { buscarTodas } from "@/db/paginar";
import { createServerClient } from "@/lib/supabase/server";

export type LancamentoExtra = Tables<"lancamentos_extras"> & { clienteNome: string };

/** Extras lançados na competência (todas as situações), do mais recente ao mais antigo. */
export async function listarExtrasDaCompetencia(competencia: string): Promise<LancamentoExtra[]> {
  const supabase = await createServerClient();
  const linhas = await buscarTodas<Tables<"lancamentos_extras"> & { clientes: { razao_social: string } | null }>(
    (de, ate) =>
      supabase
        .from("lancamentos_extras")
        .select("*, clientes(razao_social)")
        .eq("competencia", competencia)
        .order("criado_em", { ascending: false })
        .order("id")
        .range(de, ate) as never,
  );
  return linhas.map(({ clientes, ...l }) => ({ ...l, clienteNome: clientes?.razao_social ?? "—" }));
}
