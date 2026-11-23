import type { Centavos, DataISO, SituacaoCobranca } from "./tipos";

export type AcoesCobranca = { baixa: boolean; cancelar: boolean; dispensar: boolean };

/**
 * O que pode ser feito numa cobrança (espelha as regras das RPCs da migration 0008):
 * - baixa: emitida ou paga parcialmente (com saldo ainda não dispensado);
 * - cancelar: qualquer cobrança sem pagamento registrado (prevista, emitida, quitada por crédito);
 * - dispensar saldo: só paga parcialmente, uma vez.
 */
export function acoesDaCobranca(situacao: SituacaoCobranca | string, saldoDispensado: boolean): AcoesCobranca {
  const parcialAberta = situacao === "paga_parcial" && !saldoDispensado;
  return {
    baixa: situacao === "emitida" || parcialAberta,
    cancelar: situacao === "prevista" || situacao === "emitida" || situacao === "quitada_por_credito",
    dispensar: parcialAberta,
  };
}

function dataValida(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [a, m, dia] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, dia));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === dia;
}

/** Valida os dados de uma baixa manual; devolve a mensagem de erro ou null. */
export function validarBaixa(data: string, valor: Centavos, hoje: DataISO): string | null {
  if (!dataValida(data)) return "Data do pagamento inválida.";
  if (data > hoje) return "A data do pagamento não pode ser futura.";
  if (!Number.isSafeInteger(valor) || valor <= 0) return "Informe um valor recebido maior que zero.";
  return null;
}
