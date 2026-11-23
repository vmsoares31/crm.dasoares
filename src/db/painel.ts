import "server-only";

import { buscarTodas } from "@/db/paginar";
import type { CobrancaComItens } from "@/domain/painel";
import type { SituacaoCobranca, TipoItem } from "@/domain/tipos";
import { createServerClient } from "@/lib/supabase/server";

export type CobrancaPainel = CobrancaComItens & {
  id: string;
  clienteId: string;
  clienteNome: string;
  origem: string;
};

/** Cobranças da competência (com itens e carteira do contrato) para os totais do painel. */
export async function cobrancasDoPainel(competencia: string): Promise<CobrancaPainel[]> {
  const supabase = await createServerClient();
  type Linha = {
    id: string; cliente_id: string; origem: string; situacao: string; total: number; valor_recebido: number;
    saldo_dispensado: boolean; vencimento: string;
    clientes: { razao_social: string } | null;
    contratos: { carteira_id: string | null } | null;
    cobranca_itens: { tipo: string; valor: number }[] | null;
  };
  const linhas = await buscarTodas<Linha>(
    (de, ate) =>
      supabase
        .from("cobrancas")
        .select("id, cliente_id, origem, situacao, total, valor_recebido, saldo_dispensado, vencimento, clientes(razao_social), contratos(carteira_id), cobranca_itens(tipo, valor)")
        .eq("competencia", competencia)
        .order("id")
        .range(de, ate) as never,
  );
  return linhas.map((l) => ({
    id: l.id,
    clienteId: l.cliente_id,
    clienteNome: l.clientes?.razao_social ?? "—",
    origem: l.origem,
    situacao: l.situacao as SituacaoCobranca,
    total: l.total,
    valorRecebido: l.valor_recebido,
    saldoDispensado: l.saldo_dispensado,
    vencimento: l.vencimento,
    carteiraId: l.contratos?.carteira_id ?? null,
    itens: (l.cobranca_itens ?? []).map((i) => ({ tipo: i.tipo as TipoItem, valor: i.valor })),
  }));
}

export type ContagensInicio = { ativos: number; contratosSemDocumento: number; indicacoesAguardando: number };

/** Contagens do início feitas no banco (count head), sem carregar as linhas. */
export async function contagensInicio(): Promise<ContagensInicio> {
  const supabase = await createServerClient();
  const [ativos, semDoc, indicacoes, liberadas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("situacao", "ativo"),
    // contratos fechados, não legados, sem nenhum documento gerado
    supabase
      .from("contratos").select("id, contrato_documentos!left(id)", { count: "exact", head: true })
      .eq("situacao", "fechado").eq("legado", false).is("contrato_documentos", null),
    supabase.from("indicacoes").select("id", { count: "exact", head: true }).is("baixada_em", null),
    // indicações não baixadas que já tiveram crédito liberado (as demais estão aguardando o 1º pagamento)
    buscarTodas<{ indicacao_id: string | null }>(
      (de, ate) =>
        supabase.from("creditos_movimentos").select("indicacao_id").eq("tipo", "liberado").not("indicacao_id", "is", null)
          .order("id").range(de, ate) as never,
    ),
  ]);
  for (const r of [ativos, semDoc, indicacoes]) if (r.error) throw new Error(`Falha ao contar: ${r.error.message}`);
  const idsLiberadas = new Set(liberadas.map((m) => m.indicacao_id));
  return {
    ativos: ativos.count ?? 0,
    contratosSemDocumento: semDoc.count ?? 0,
    indicacoesAguardando: Math.max(0, (indicacoes.count ?? 0) - idsLiberadas.size),
  };
}
