import "server-only";

import type { Json, Tables } from "@/db/database.types";
import { buscarTodas } from "@/db/paginar";
import {
  planejarCompetencia, validarEdicaoItens,
  type CobrancaExistente, type DadosCompetencia, type ExtraDaCompetencia, type MovimentoCredito,
} from "@/domain/competencia";
import type { ContratoFechamento, ResultadoFechamento } from "@/domain/fechamento";
import type { Competencia, ItemCobranca, SituacaoCobranca, TipoCobranca, TipoItem } from "@/domain/tipos";
import { createServerClient } from "@/lib/supabase/server";

/** Erro com mensagem que pode ser mostrada ao usuário. */
export class ErroCobranca extends Error {}

export type OpcoesCompetencia = {
  /** Restringe a operação a estes clientes (sem isto, vale para todos). */
  clienteIds?: string[];
};

export type ResultadoCompetencia = ResultadoFechamento & { mantidas: number; removidas: number };

const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

type Supabase = Awaited<ReturnType<typeof createServerClient>>;

function erroRpc(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    return new ErroCobranca("As cobranças desta competência mudaram durante a operação. Recarregue a página e tente novamente.");
  }
  if (error.code === "22023" || error.code === "40001" || error.code === "P0002") return new ErroCobranca(error.message);
  return new Error(error.message);
}

type LinhaContrato = {
  id: string; cliente_id: string; honorario: number | null; dia_vencimento: number | null;
  carteira_id: string | null; tipo_cobranca: string | null;
  clientes: { razao_social: string; situacao: string };
  parcelas_adicionais: { id: string; mes: number; valor: number; forma: string; dia: number | null }[];
};

async function carregarDados(supabase: Supabase, competencia: Competencia, regerar: boolean, opcoes: OpcoesCompetencia): Promise<DadosCompetencia> {
  const ids = opcoes.clienteIds;
  const [contratos, cobrancas, extras, movimentos] = await Promise.all([
    buscarTodas<LinhaContrato>((de, ate) => {
      let q = supabase
        .from("contratos")
        .select("id, cliente_id, honorario, dia_vencimento, carteira_id, tipo_cobranca, clientes!inner(razao_social, situacao), parcelas_adicionais(id, mes, valor, forma, dia)")
        .eq("situacao", "fechado")
        .eq("clientes.situacao", "ativo");
      if (ids) q = q.in("cliente_id", ids);
      return q.order("id").range(de, ate) as never;
    }),
    buscarTodas<Pick<Tables<"cobrancas">, "id" | "cliente_id" | "contrato_id" | "origem" | "parcela_id" | "situacao" | "excluida_do_mes">>((de, ate) => {
      let q = supabase.from("cobrancas").select("id, cliente_id, contrato_id, origem, parcela_id, situacao, excluida_do_mes").eq("competencia", competencia);
      if (ids) q = q.in("cliente_id", ids);
      return q.order("id").range(de, ate) as never;
    }),
    buscarTodas<Pick<Tables<"lancamentos_extras">, "id" | "cliente_id" | "descricao" | "valor" | "competencia" | "situacao" | "cobranca_id">>((de, ate) => {
      let q = supabase
        .from("lancamentos_extras")
        .select("id, cliente_id, descricao, valor, competencia, situacao, cobranca_id")
        .eq("competencia", competencia)
        .neq("situacao", "cancelado");
      if (ids) q = q.in("cliente_id", ids);
      return q.order("criado_em").order("id").range(de, ate) as never;
    }),
    buscarTodas<Pick<Tables<"creditos_movimentos">, "cliente_id" | "tipo" | "valor" | "cobranca_id">>((de, ate) => {
      let q = supabase.from("creditos_movimentos").select("cliente_id, tipo, valor, cobranca_id");
      if (ids) q = q.in("cliente_id", ids);
      return q.order("id").range(de, ate) as never;
    }),
  ]);

  return {
    competencia,
    regerar,
    contratos: contratos.map((c): ContratoFechamento => ({
      clienteId: c.cliente_id, contratoId: c.id, clienteNome: c.clientes.razao_social,
      honorario: c.honorario, diaVencimento: c.dia_vencimento, carteiraId: c.carteira_id,
      tipoCobranca: c.tipo_cobranca as TipoCobranca | null,
      parcelas: (c.parcelas_adicionais ?? []).map((p) => ({
        id: p.id, mes: p.mes, valor: p.valor, forma: p.forma as "junto_mensalidade" | "data_propria", dia: p.dia,
      })),
    })),
    cobrancasExistentes: cobrancas.map((c): CobrancaExistente => ({
      id: c.id, clienteId: c.cliente_id, contratoId: c.contrato_id, origem: c.origem as CobrancaExistente["origem"],
      parcelaId: c.parcela_id, situacao: c.situacao as SituacaoCobranca, excluidaDoMes: c.excluida_do_mes,
    })),
    extras: extras.map((e): ExtraDaCompetencia => ({
      id: e.id, clienteId: e.cliente_id, descricao: e.descricao, valor: e.valor, competencia: e.competencia,
      situacao: e.situacao as ExtraDaCompetencia["situacao"], cobrancaId: e.cobranca_id,
    })),
    movimentos: movimentos.map((m): MovimentoCredito => ({
      clienteId: m.cliente_id, tipo: m.tipo as MovimentoCredito["tipo"], valor: m.valor, cobrancaId: m.cobranca_id,
    })),
  };
}

async function gravar(competencia: string, regerar: boolean, opcoes: OpcoesCompetencia = {}): Promise<ResultadoCompetencia> {
  if (!COMPETENCIA.test(competencia)) throw new ErroCobranca("Competência inválida. Use o formato AAAA-MM.");
  const supabase = await createServerClient();
  const dados = await carregarDados(supabase, competencia as Competencia, regerar, opcoes);
  const plano = planejarCompetencia(dados);

  const payload = plano.cobrancas.map((c) => ({
    cliente_id: c.clienteId, contrato_id: c.contratoId, origem: c.origem, parcela_id: c.parcelaId,
    vencimento: c.vencimento, total: c.total, situacao: c.situacao, descricao: c.descricao, credito_usado: c.creditoUsado,
    itens: c.itens.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, ref_id: i.refId ?? null })),
  }));
  const { error } = await supabase.rpc("gravar_competencia", {
    p_competencia: competencia,
    p_regerar: regerar,
    p_cobrancas: payload as unknown as Json,
    ...(opcoes.clienteIds ? { p_clientes: opcoes.clienteIds } : {}),
  });
  if (error) throw erroRpc(error);

  return { cobrancas: plano.cobrancas, naoGerados: plano.naoGerados, mantidas: plano.mantidas.length, removidas: plano.removidas.length };
}

/** Abre o mês: gera as cobranças que ainda não existem (não duplica nem mexe nas existentes). */
export function abrirCompetencia(competencia: string, opcoes?: OpcoesCompetencia): Promise<ResultadoCompetencia> {
  return gravar(competencia, false, opcoes);
}

/**
 * Refaz as cobranças previstas/quitadas por crédito; emitidas, pagas e canceladas ficam intactas.
 * Canceladas pelo "Cancelar" geral (não excluídas do mês) ganham uma substituta.
 */
export function regerarCompetencia(competencia: string, opcoes?: OpcoesCompetencia): Promise<ResultadoCompetencia> {
  return gravar(competencia, true, opcoes);
}

/** Troca os itens de uma cobrança prevista (recalcula total e descrição). */
export async function editarCobranca(id: string, itens: ItemCobranca[]): Promise<void> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas").select("situacao, cobranca_itens(tipo, descricao, valor, ref_id)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ErroCobranca("Cobrança não encontrada.");
  if (data.situacao !== "prevista") throw new ErroCobranca("Só é possível editar cobranças previstas.");

  const antigos: ItemCobranca[] = (data.cobranca_itens ?? []).map((i) => ({
    tipo: i.tipo as TipoItem, descricao: i.descricao, valor: i.valor, ...(i.ref_id ? { refId: i.ref_id } : {}),
  }));
  const r = validarEdicaoItens(antigos, itens);
  if ("erro" in r) throw new ErroCobranca(r.erro);

  const { error: erroRpcEdicao } = await supabase.rpc("editar_cobranca", {
    p_cobranca_id: id,
    p_descricao: r.descricao,
    p_itens: r.itens.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, ref_id: i.refId ?? null })) as unknown as Json,
  });
  if (erroRpcEdicao) throw erroRpc(erroRpcEdicao);
}

/** "Excluir cliente do mês": cancela uma cobrança prevista com motivo. */
export async function cancelarCobrancaPrevista(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroCobranca("Informe o motivo.");
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("cancelar_cobranca_prevista", { p_cobranca_id: id, p_motivo: motivo.trim() });
  if (error) throw erroRpc(error);
}

export type ItemLinha = Pick<Tables<"cobranca_itens">, "id" | "tipo" | "descricao" | "valor" | "ref_id">;
export type CobrancaLinha = Tables<"cobrancas"> & { clienteNome: string; itens: ItemLinha[] };

/** Cobranças da competência com itens e nome do cliente, em ordem alfabética do cliente. */
export async function listarCobrancasDaCompetencia(competencia: string): Promise<CobrancaLinha[]> {
  const supabase = await createServerClient();
  const linhas = await buscarTodas<Tables<"cobrancas"> & { clientes: { razao_social: string } | null; cobranca_itens: ItemLinha[] }>(
    (de, ate) =>
      supabase
        .from("cobrancas")
        .select("*, clientes(razao_social), cobranca_itens(id, tipo, descricao, valor, ref_id)")
        .eq("competencia", competencia)
        .order("id")
        .range(de, ate) as never,
  );
  const ordemTipo: Record<string, number> = { mensalidade: 0, extra: 1, parcela_adicional: 2, desconto_indicacao: 3 };
  return linhas
    .map(({ clientes, cobranca_itens, ...c }) => ({
      ...c,
      clienteNome: clientes?.razao_social ?? "—",
      itens: [...(cobranca_itens ?? [])].sort((a, b) => (ordemTipo[a.tipo] ?? 9) - (ordemTipo[b.tipo] ?? 9)),
    }))
    .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome, "pt-BR") || a.origem.localeCompare(b.origem));
}

/** Prévia sem gravar: quem ficaria de fora do mês (dados obrigatórios faltando). */
export async function previaNaoGerados(competencia: string): Promise<ResultadoFechamento["naoGerados"]> {
  if (!COMPETENCIA.test(competencia)) return [];
  const supabase = await createServerClient();
  const dados = await carregarDados(supabase, competencia as Competencia, false, {});
  return planejarCompetencia(dados).naoGerados;
}

/** Extras pendentes da competência (ainda fora de qualquer cobrança). */
export async function contarExtrasPendentes(competencia: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("lancamentos_extras").select("id", { count: "exact", head: true })
    .eq("competencia", competencia).eq("situacao", "pendente");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Baixa manual, cancelamento e dispensa de saldo (RPCs da migration 0008)
// ---------------------------------------------------------------------------

export type ResultadoBaixa = {
  situacao: "paga" | "paga_parcial";
  valorRecebido: number;
  creditoLiberado: number;
  indicadorId: string | null;
};

/** Registra um pagamento (data, valor em centavos); pode liberar o crédito do indicador. */
export async function registrarBaixa(cobrancaId: string, data: string, valor: number): Promise<ResultadoBaixa> {
  const supabase = await createServerClient();
  const { data: r, error } = await supabase.rpc("registrar_baixa", { p_cobranca_id: cobrancaId, p_data: data, p_valor: valor });
  if (error) throw erroRpc(error);
  const o = (r ?? {}) as { situacao?: string; valor_recebido?: number; credito_liberado?: number; indicador_id?: string | null };
  return {
    situacao: o.situacao === "paga" ? "paga" : "paga_parcial",
    valorRecebido: Number(o.valor_recebido ?? 0),
    creditoLiberado: Number(o.credito_liberado ?? 0),
    indicadorId: o.indicador_id ?? null,
  };
}

/** Cancela com motivo uma cobrança ainda não paga; devolve o crédito de indicação estornado. */
export async function cancelarCobranca(id: string, motivo: string): Promise<{ estornado: number }> {
  if (!motivo.trim()) throw new ErroCobranca("Informe o motivo.");
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("cancelar_cobranca", { p_cobranca_id: id, p_motivo: motivo.trim() });
  if (error) throw erroRpc(error);
  return { estornado: Number((data as { estornado?: number } | null)?.estornado ?? 0) };
}

/** Encerra o saldo restante de uma cobrança paga parcialmente. */
export async function dispensarSaldo(id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new ErroCobranca("Informe o motivo.");
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("dispensar_saldo", { p_cobranca_id: id, p_motivo: motivo.trim() });
  if (error) throw erroRpc(error);
}

export type PagamentoLinha = Pick<Tables<"pagamentos">, "id" | "data" | "valor" | "criado_em">;
export type MovimentoLinha = Pick<Tables<"creditos_movimentos">, "id" | "tipo" | "valor" | "criado_em" | "cliente_id">;
export type CobrancaDetalhe = Tables<"cobrancas"> & {
  clienteNome: string;
  itens: ItemLinha[];
  pagamentos: PagamentoLinha[];
  movimentos: MovimentoLinha[];
};

/** Cobrança com itens, pagamentos e movimentos de crédito ligados a ela; null se não existir. */
export async function obterCobranca(id: string): Promise<CobrancaDetalhe | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, clientes(razao_social), cobranca_itens(id, tipo, descricao, valor, ref_id), pagamentos(id, data, valor, criado_em), creditos_movimentos(id, tipo, valor, criado_em, cliente_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { clientes, cobranca_itens, pagamentos, creditos_movimentos, ...c } = data as typeof data & {
    clientes: { razao_social: string } | null;
    cobranca_itens: ItemLinha[] | null;
    pagamentos: PagamentoLinha[] | null;
    creditos_movimentos: MovimentoLinha[] | null;
  };
  const ordemTipo: Record<string, number> = { mensalidade: 0, extra: 1, parcela_adicional: 2, desconto_indicacao: 3 };
  return {
    ...(c as Tables<"cobrancas">),
    clienteNome: clientes?.razao_social ?? "—",
    itens: [...(cobranca_itens ?? [])].sort((a, b) => (ordemTipo[a.tipo] ?? 9) - (ordemTipo[b.tipo] ?? 9)),
    pagamentos: [...(pagamentos ?? [])].sort((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em)),
    movimentos: [...(creditos_movimentos ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
  };
}

export type CobrancaAtrasada = {
  id: string; clienteId: string; clienteNome: string; competencia: string; origem: string;
  vencimento: string; total: number; valorRecebido: number; saldoAberto: number; situacao: string;
};

/**
 * Inadimplência: cobranças emitidas ou pagas parcialmente, vencidas antes de hoje
 * (America/Sao_Paulo) e com saldo em aberto — usa `v_cobrancas.atrasada`/`saldo_aberto`.
 */
export async function listarCobrancasAtrasadas(): Promise<CobrancaAtrasada[]> {
  const supabase = await createServerClient();
  type Linha = Pick<Tables<"v_cobrancas">, "id" | "cliente_id" | "competencia" | "origem" | "vencimento" | "total" | "valor_recebido" | "saldo_aberto" | "situacao"> & {
    clientes: { razao_social: string } | null;
  };
  const linhas = await buscarTodas<Linha>((de, ate) =>
    supabase
      .from("v_cobrancas")
      .select("id, cliente_id, competencia, origem, vencimento, total, valor_recebido, saldo_aberto, situacao, clientes(razao_social)")
      .eq("atrasada", true)
      .gt("saldo_aberto", 0)
      .order("vencimento")
      .order("id")
      .range(de, ate) as never,
  );
  return linhas.map((l) => ({
    id: l.id!, clienteId: l.cliente_id!, clienteNome: l.clientes?.razao_social ?? "—", competencia: l.competencia!,
    origem: l.origem!, vencimento: l.vencimento!, total: l.total ?? 0, valorRecebido: l.valor_recebido ?? 0,
    saldoAberto: l.saldo_aberto ?? 0, situacao: l.situacao!,
  }));
}
