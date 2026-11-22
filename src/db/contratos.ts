import "server-only";

import type { Tables } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

export type Contrato = Tables<"contratos">;

export type CamposContratoLegado = {
  honorario: number | null;
  dia_vencimento: number | null;
  carteira_id: string | null;
  tipo_cobranca: string | null;
  email_cobranca: string | null;
};

/**
 * Edição em massa: se o cliente não tem contrato vigente, cria um contrato
 * legado (legado=true, situacao='fechado'); senão atualiza o contrato não encerrado.
 */
export async function upsertContratoLegado(
  clienteId: string,
  campos: CamposContratoLegado,
): Promise<{ id: string; criado: boolean }> {
  const supabase = await createServerClient();
  const { data: atual, error: erroBusca } = await supabase
    .from("contratos")
    .select("id")
    .eq("cliente_id", clienteId)
    .neq("situacao", "encerrado")
    .maybeSingle();
  if (erroBusca) throw new Error(`Falha ao buscar contrato: ${erroBusca.message}`);

  if (atual) {
    const { error } = await supabase.from("contratos").update(campos).eq("id", atual.id);
    if (error) throw new Error(`Falha ao atualizar contrato: ${error.message}`);
    return { id: atual.id, criado: false };
  }
  const { data, error } = await supabase
    .from("contratos")
    .insert({ ...campos, cliente_id: clienteId, legado: true, situacao: "fechado" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha ao criar contrato: ${error?.message}`);
  return { id: data.id, criado: true };
}
