import "server-only";

import { saldoDeCredito } from "@/domain/competencia";
import { situacoesDasIndicacoes, type SituacaoIndicacao } from "@/domain/indicacao";
import type { Centavos } from "@/domain/tipos";
import { buscarTodas } from "@/db/paginar";
import { createServerClient } from "@/lib/supabase/server";

/** Erro com mensagem que pode ser mostrada ao usuário. */
export class ErroIndicacao extends Error {}

export type TipoMovimento = "gerado" | "liberado" | "usado" | "estornado";

function erroRpc(error: { code?: string; message: string }): Error {
  if (error.code === "22023" || error.code === "P0002") return new ErroIndicacao(error.message);
  if (error.code === "23505") return new ErroIndicacao("Este cliente já foi indicado.");
  return new Error(error.message);
}

export type ResultadoIndicacao = { indicacaoId: string; gerado: Centavos; liberado: Centavos };

/**
 * Registra que `indicadorId` indicou `indicadoId` (RPC registrar_indicacao, uma transação):
 * grava a indicação, clientes.indicado_por e o movimento 'gerado' =
 * creditoDaIndicacao(honorário do contrato vigente do indicado, escritorio.indicacao_pct).
 * Se a 1ª cobrança do indicado já estiver paga, libera o crédito na hora.
 */
export async function registrarIndicacao(indicadorId: string, indicadoId: string): Promise<ResultadoIndicacao> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("registrar_indicacao", {
    p_indicador_id: indicadorId,
    p_indicado_id: indicadoId,
  });
  if (error) throw erroRpc(error);
  const o = (data ?? {}) as { indicacao_id?: string; gerado?: number; liberado?: number };
  return { indicacaoId: o.indicacao_id ?? "", gerado: Number(o.gerado ?? 0), liberado: Number(o.liberado ?? 0) };
}

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export type MovimentoExtrato = {
  id: string;
  tipo: TipoMovimento;
  valor: Centavos;
  criadoEm: string;
  cobrancaId: string | null;
  /** Cliente indicado que originou o crédito (gerado/liberado). */
  indicado: { id: string; nome: string } | null;
};

export type ExtratoCredito = {
  movimentos: MovimentoExtrato[];
  /** liberado − usado + estornado (o mesmo saldo que a competência usa). */
  saldoDisponivel: Centavos;
  /** Gerado e ainda não liberado (aguardando o 1º pagamento do indicado). */
  aLiberar: Centavos;
};

type LinhaMovimento = {
  id: string; tipo: string; valor: number; criado_em: string; cobranca_id: string | null; indicacao_id: string | null;
  indicacoes: { indicado_id: string; indicado: { razao_social: string } | null } | null;
};

/** Movimentos de crédito do cliente (mais recentes primeiro) e o saldo disponível. */
export async function extratoCredito(clienteId: string): Promise<ExtratoCredito> {
  const supabase = await createServerClient();
  const linhas = await buscarTodas<LinhaMovimento>(
    (de, ate) =>
      supabase
        .from("creditos_movimentos")
        .select("id, tipo, valor, criado_em, cobranca_id, indicacao_id, indicacoes(indicado_id, indicado:clientes!indicacoes_indicado_id_fkey(razao_social))")
        .eq("cliente_id", clienteId)
        .order("criado_em", { ascending: false })
        .order("id")
        .range(de, ate) as never,
  );
  const movimentos: MovimentoExtrato[] = linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoMovimento,
    valor: Number(l.valor),
    criadoEm: l.criado_em,
    cobrancaId: l.cobranca_id,
    indicado: l.indicacoes ? { id: l.indicacoes.indicado_id, nome: l.indicacoes.indicado?.razao_social ?? "—" } : null,
  }));
  const saldoDisponivel =
    saldoDeCredito(movimentos.map((m) => ({ clienteId, tipo: m.tipo, valor: m.valor, cobrancaId: m.cobrancaId })))[clienteId] ?? 0;

  const liberadas = new Set(linhas.filter((l) => l.tipo === "liberado" && l.indicacao_id).map((l) => l.indicacao_id));
  const aLiberar = linhas
    .filter((l) => l.tipo === "gerado" && l.indicacao_id && !liberadas.has(l.indicacao_id))
    .reduce((s, l) => s + Number(l.valor), 0);

  return { movimentos, saldoDisponivel, aLiberar };
}

// ---------------------------------------------------------------------------
// Lista de indicações
// ---------------------------------------------------------------------------

export type IndicacaoLinha = {
  id: string;
  criadoEm: string;
  indicador: { id: string; nome: string };
  indicado: { id: string; nome: string };
  /** Crédito: o liberado, se houver; senão o gerado. */
  valor: Centavos;
  situacao: SituacaoIndicacao;
  /** Quanto do crédito liberado já foi consumido em cobranças do indicador. */
  consumido: Centavos;
};

type LinhaIndicacao = {
  id: string; indicador_id: string; indicado_id: string; criado_em: string;
  indicador: { razao_social: string } | null; indicado: { razao_social: string } | null;
};

const SELECT_INDICACAO =
  "id, indicador_id, indicado_id, criado_em, indicador:clientes!indicacoes_indicador_id_fkey(razao_social), indicado:clientes!indicacoes_indicado_id_fkey(razao_social)";

/**
 * Indicações com valor e situação (aguardando 1º pagamento / liberado / usado).
 * Com `clienteId`, só as que envolvem o cliente (como indicador ou indicado); a situação é
 * sempre calculada com todas as indicações dos indicadores envolvidos (consumo FIFO).
 */
export async function listarIndicacoes(filtro: { clienteId?: string } = {}): Promise<IndicacaoLinha[]> {
  const supabase = await createServerClient();

  let indicacoes: LinhaIndicacao[];
  if (filtro.clienteId) {
    const id = filtro.clienteId;
    const { data, error } = await supabase
      .from("indicacoes")
      .select("indicador_id")
      .or(`indicador_id.eq.${id},indicado_id.eq.${id}`);
    if (error) throw new Error(`Falha ao listar indicações: ${error.message}`);
    const indicadores = [...new Set((data ?? []).map((d) => d.indicador_id))];
    if (indicadores.length === 0) return [];
    const r = await supabase.from("indicacoes").select(SELECT_INDICACAO).in("indicador_id", indicadores);
    if (r.error) throw new Error(`Falha ao listar indicações: ${r.error.message}`);
    indicacoes = (r.data ?? []) as unknown as LinhaIndicacao[];
  } else {
    indicacoes = await buscarTodas<LinhaIndicacao>(
      (de, ate) => supabase.from("indicacoes").select(SELECT_INDICACAO).order("criado_em").order("id").range(de, ate) as never,
    );
  }
  if (indicacoes.length === 0) return [];

  const indicadores = [...new Set(indicacoes.map((i) => i.indicador_id))];
  const movimentos = await buscarTodas<{ cliente_id: string; indicacao_id: string | null; tipo: string; valor: number; criado_em: string }>(
    (de, ate) => {
      const q = supabase.from("creditos_movimentos").select("cliente_id, indicacao_id, tipo, valor, criado_em");
      return (filtro.clienteId ? q.in("cliente_id", indicadores) : q).order("id").range(de, ate) as never;
    },
  );

  const gerado = new Map<string, number>();
  const liberado = new Map<string, { valor: number; em: string }>();
  for (const m of movimentos) {
    if (!m.indicacao_id) continue;
    if (m.tipo === "gerado") gerado.set(m.indicacao_id, (gerado.get(m.indicacao_id) ?? 0) + Number(m.valor));
    if (m.tipo === "liberado") {
      const atual = liberado.get(m.indicacao_id);
      liberado.set(m.indicacao_id, {
        valor: (atual?.valor ?? 0) + Number(m.valor),
        em: atual && atual.em < m.criado_em ? atual.em : m.criado_em,
      });
    }
  }

  const situacoes = situacoesDasIndicacoes(
    indicacoes.map((i) => ({
      id: i.id,
      indicadorId: i.indicador_id,
      liberado: liberado.get(i.id)?.valor ?? null,
      liberadoEm: liberado.get(i.id)?.em ?? null,
    })),
    movimentos.map((m) => ({ clienteId: m.cliente_id, tipo: m.tipo as TipoMovimento, valor: Number(m.valor) })),
  );

  const id = filtro.clienteId;
  return indicacoes
    .filter((i) => !id || i.indicador_id === id || i.indicado_id === id)
    .map((i) => ({
      id: i.id,
      criadoEm: i.criado_em,
      indicador: { id: i.indicador_id, nome: i.indicador?.razao_social ?? "—" },
      indicado: { id: i.indicado_id, nome: i.indicado?.razao_social ?? "—" },
      valor: liberado.get(i.id)?.valor ?? gerado.get(i.id) ?? 0,
      situacao: situacoes[i.id].situacao,
      consumido: situacoes[i.id].consumido,
    }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || a.id.localeCompare(b.id));
}

/** Clientes que podem ser indicados: com contrato vigente com honorário e ainda não indicados. */
export async function listarIndicaveis(): Promise<{ id: string; razao_social: string }[]> {
  const supabase = await createServerClient();
  const [clientes, jaIndicados] = await Promise.all([
    buscarTodas<{ id: string; razao_social: string; contratos: { situacao: string; honorario: number | null }[] }>(
      (de, ate) =>
        supabase
          .from("clientes")
          .select("id, razao_social, contratos(situacao, honorario)")
          .order("razao_social")
          .order("id")
          .range(de, ate) as never,
    ),
    buscarTodas<{ indicado_id: string }>(
      (de, ate) => supabase.from("indicacoes").select("indicado_id").order("id").range(de, ate) as never,
    ),
  ]);
  const indicados = new Set(jaIndicados.map((i) => i.indicado_id));
  return clientes
    .filter((c) => !indicados.has(c.id) && c.contratos.some((k) => k.situacao !== "encerrado" && (k.honorario ?? 0) > 0))
    .map((c) => ({ id: c.id, razao_social: c.razao_social }));
}
