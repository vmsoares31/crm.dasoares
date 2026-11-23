import "server-only";

import { buscarTodas } from "@/db/paginar";
import type { SaidaCarteira, TipoCobranca } from "@/domain/tipos";
import { createServerClient } from "@/lib/supabase/server";

export const ACAO_EXPORTAR = "cobrancas.exportar";
const LOTE = 100;

export type CobrancaExportavel = {
  id: string; clienteNome: string; documento: string; email: string; vencimento: string; total: number;
  descricao: string; situacao: string; carteiraId: string | null; carteiraNome: string; tipo: TipoCobranca | null;
};

type Linha = {
  id: string; vencimento: string; total: number; descricao: string; situacao: string;
  clientes: { razao_social: string; documento: string | null; email: string | null } | null;
  contratos: { carteira_id: string | null; tipo_cobranca: string | null } | null;
};

/** Cobranças da competência (sem canceladas) com os dados de cliente, carteira e forma de cobrança. */
export async function listarExportaveis(competencia: string): Promise<CobrancaExportavel[]> {
  const supabase = await createServerClient();
  const [linhas, { data: carteiras, error }] = await Promise.all([
    buscarTodas<Linha>((de, ate) =>
      supabase
        .from("cobrancas")
        .select("id, vencimento, total, descricao, situacao, clientes(razao_social, documento, email), contratos(carteira_id, tipo_cobranca)")
        .eq("competencia", competencia)
        .neq("situacao", "cancelada")
        .order("id")
        .range(de, ate) as never,
    ),
    supabase.from("carteiras").select("id, nome"),
  ]);
  if (error) throw new Error(error.message);
  const nomes = new Map((carteiras ?? []).map((c) => [c.id, c.nome]));
  return linhas
    .map((l): CobrancaExportavel => ({
      id: l.id, clienteNome: l.clientes?.razao_social ?? "—", documento: l.clientes?.documento ?? "",
      email: l.clientes?.email ?? "", vencimento: l.vencimento, total: l.total, descricao: l.descricao, situacao: l.situacao,
      carteiraId: l.contratos?.carteira_id ?? null,
      carteiraNome: (l.contratos?.carteira_id && nomes.get(l.contratos.carteira_id)) || "Sem carteira",
      tipo: (l.contratos?.tipo_cobranca as TipoCobranca | null) ?? null,
    }))
    .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
}

export async function listarSaidasCarteiras(): Promise<{ id: string; nome: string; saida: SaidaCarteira }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("carteiras").select("id, nome, saida").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, nome: c.nome, saida: c.saida as SaidaCarteira }));
}

/** Ids da última exportação registrada na auditoria para a competência (vazio se não houver). */
export async function idsDoUltimoArquivo(competencia: string): Promise<string[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("auditoria").select("dados")
    .eq("acao", ACAO_EXPORTAR).eq("entidade", "competencia").eq("dados->>competencia", competencia)
    .order("em", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const dados = data?.[0]?.dados as { cobranca_ids?: unknown } | null | undefined;
  const ids = dados?.cobranca_ids;
  return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
}

function lotes<T>(itens: T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += LOTE) r.push(itens.slice(i, i + LOTE));
  return r;
}

/** prevista → emitida (só as que ainda estão previstas). Devolve os ids efetivamente marcados. */
export async function marcarEmitidas(competencia: string, ids: string[]): Promise<string[]> {
  const supabase = await createServerClient();
  const agora = new Date().toISOString();
  const marcadas: string[] = [];
  for (const parte of lotes(ids)) {
    const { data, error } = await supabase
      .from("cobrancas").update({ situacao: "emitida", emitida_em: agora })
      .in("id", parte).eq("competencia", competencia).eq("situacao", "prevista").select("id");
    if (error) throw new Error(error.message);
    marcadas.push(...(data ?? []).map((d) => d.id));
  }
  return marcadas;
}

/** Troca o vencimento das cobranças ainda previstas. Devolve os ids atualizados. */
export async function aplicarVencimento(competencia: string, ids: string[], vencimento: string): Promise<string[]> {
  const supabase = await createServerClient();
  const atualizadas: string[] = [];
  for (const parte of lotes(ids)) {
    const { data, error } = await supabase
      .from("cobrancas").update({ vencimento })
      .in("id", parte).eq("competencia", competencia).eq("situacao", "prevista").select("id");
    if (error) throw new Error(error.message);
    atualizadas.push(...(data ?? []).map((d) => d.id));
  }
  return atualizadas;
}

