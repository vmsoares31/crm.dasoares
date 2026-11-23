import { aplicarPercentual } from "./dinheiro";
import type { Centavos, SituacaoCobranca } from "./tipos";

export interface Indicacao { id: string; indicadorId: string; indicadoId: string }

/** Situação da cobrança depois de uma baixa: recebeu o total (ou mais, com acréscimo) → paga. */
export function situacaoAposBaixa(total: Centavos, recebidoAcumulado: Centavos): "paga" | "paga_parcial" {
  return recebidoAcumulado >= total ? "paga" : "paga_parcial";
}

/** Crédito do indicador: `pct`% do honorário do indicado, ao centavo (meio para cima). */
export function creditoDaIndicacao(honorarioIndicado: Centavos, pct: number): Centavos {
  return aplicarPercentual(honorarioIndicado, pct);
}

/**
 * O crédito do indicador é liberado quando a primeira cobrança do indicado é paga integralmente
 * (§6.5): só com situação `paga`, uma única vez por indicação.
 */
export function deveLiberarCredito(
  cobrancaPaga: { clienteId: string; situacao: SituacaoCobranca },
  ehPrimeiraCobrancaDoCliente: boolean,
  indicacao: Indicacao | null,
  jaLiberado: boolean,
): boolean {
  return (
    cobrancaPaga.situacao === "paga" &&
    ehPrimeiraCobrancaDoCliente &&
    indicacao !== null &&
    indicacao.indicadoId === cobrancaPaga.clienteId &&
    !jaLiberado
  );
}

// ---------------------------------------------------------------------------
// Reavaliação da liberação (espelha reavaliar_credito_indicacao, 0009)
// ---------------------------------------------------------------------------

export interface CobrancaDoIndicado {
  id: string; situacao: SituacaoCobranca; vencimento: string; criadoEm: string;
}

/** Primeira cobrança do cliente: a mais antiga não cancelada (vencimento, criação, id). */
export function primeiraCobranca<T extends CobrancaDoIndicado>(cobrancas: T[]): T | null {
  const validas = cobrancas.filter((c) => c.situacao !== "cancelada");
  validas.sort(
    (a, b) =>
      a.vencimento.localeCompare(b.vencimento) || a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id),
  );
  return validas[0] ?? null;
}

/**
 * Regra única de liberação, reavaliável a qualquer momento (idempotente): libera se ainda não
 * houve liberação e a primeira cobrança do indicado (a mais antiga não cancelada) está `paga`.
 * Devolve a cobrança que justifica a liberação, ou null.
 */
export function cobrancaQueLibera<T extends CobrancaDoIndicado>(cobrancasDoIndicado: T[], jaLiberado: boolean): T | null {
  if (jaLiberado) return null;
  const p = primeiraCobranca(cobrancasDoIndicado);
  return p && p.situacao === "paga" ? p : null;
}

// ---------------------------------------------------------------------------
// Situação das indicações na lista
// ---------------------------------------------------------------------------

export type SituacaoIndicacao = "aguardando" | "liberado" | "usado";

export interface IndicacaoComCredito {
  id: string;
  indicadorId: string;
  /** Valor liberado (null enquanto aguarda o 1º pagamento). */
  liberado: Centavos | null;
  /** Momento da liberação (ordena o consumo). */
  liberadoEm: string | null;
}

export interface MovimentoDeUso { clienteId: string; tipo: "gerado" | "liberado" | "usado" | "estornado"; valor: Centavos }

/**
 * Situação de cada indicação:
 * - `aguardando`: sem movimento `liberado` (1º pagamento do indicado ainda não quitado);
 * - `usado`: o crédito liberado foi consumido por inteiro;
 * - `liberado`: liberado e ainda com saldo (total ou parcial).
 * Os movimentos `usado`/`estornado` são do indicador, não da indicação: o consumo líquido do
 * indicador (usado − estornado) é atribuído às indicações na ordem de liberação (FIFO).
 * Devolve também quanto de cada indicação já foi consumido.
 */
export function situacoesDasIndicacoes(
  indicacoes: IndicacaoComCredito[],
  movimentos: MovimentoDeUso[],
): Record<string, { situacao: SituacaoIndicacao; consumido: Centavos }> {
  const consumo: Record<string, Centavos> = {};
  for (const m of movimentos) {
    const s = m.tipo === "usado" ? 1 : m.tipo === "estornado" ? -1 : 0;
    if (s) consumo[m.clienteId] = (consumo[m.clienteId] ?? 0) + s * m.valor;
  }
  const out: Record<string, { situacao: SituacaoIndicacao; consumido: Centavos }> = {};
  const liberadas = indicacoes
    .filter((i) => i.liberado !== null)
    .sort((a, b) => (a.liberadoEm ?? "").localeCompare(b.liberadoEm ?? "") || a.id.localeCompare(b.id));
  const restante: Record<string, Centavos> = {};
  for (const i of liberadas) {
    const disp = restante[i.indicadorId] ?? Math.max(0, consumo[i.indicadorId] ?? 0);
    const consumido = Math.min(disp, i.liberado!);
    restante[i.indicadorId] = disp - consumido;
    out[i.id] = { situacao: consumido >= i.liberado! ? "usado" : "liberado", consumido };
  }
  for (const i of indicacoes) if (i.liberado === null) out[i.id] = { situacao: "aguardando", consumido: 0 };
  return out;
}
