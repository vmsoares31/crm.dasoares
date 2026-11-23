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
