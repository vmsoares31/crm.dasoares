import "server-only";

import type { Json } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Registra uma ação na tabela `auditoria` em nome do usuário logado.
 * Ex.: registrarAuditoria('cobranca.baixa', 'cobrancas', id, { valor: 22000 }).
 * Lança erro se não houver usuário autenticado ou se a gravação falhar.
 */
export async function registrarAuditoria(
  acao: string,
  entidade: string,
  entidadeId: string | null,
  dados?: object,
): Promise<void> {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();
  if (erroUsuario || !user) {
    throw new Error("Auditoria: nenhum usuário autenticado.");
  }

  const { error } = await supabase.from("auditoria").insert({
    usuario_id: user.id,
    acao,
    entidade,
    entidade_id: entidadeId,
    dados: (dados ?? null) as Json | null,
  });
  if (error) {
    throw new Error(`Auditoria: falha ao registrar "${acao}": ${error.message}`);
  }
}
