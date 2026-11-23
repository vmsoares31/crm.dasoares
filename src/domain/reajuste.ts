import { aplicarPercentual, arredondarParaCimaReal } from "./dinheiro";
import type { Centavos, ParcelaAdicional } from "./tipos";

/** aplicarPercentual devolve só o acréscimo; o valor reajustado é o valor + acréscimo. */
function reajustar(c: Centavos, pct: number): Centavos {
  return c + aplicarPercentual(c, pct);
}

export type ContratoParaReajuste = {
  id: string;
  honorario: Centavos | null;
  parcela_adicional_total: Centavos;
  parcelas: ParcelaAdicional[];
};

export type PreviaContrato = {
  contratoId: string;
  honorarioDe: Centavos;
  honorarioPara: Centavos;
  parcelaDe: Centavos;
  parcelaPara: Centavos;
  parcelas: ParcelaAdicional[];
};

/** Converte "4,75" em 4.75; aceita 0 < pct <= 100, senão null. */
export function parsePercentual(s: string): number | null {
  const limpo = s.trim().replace("%", "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return n > 0 && n <= 100 ? n : null;
}

/**
 * Distribui `novoTotal` entre as parcelas na proporção dos valores atuais,
 * pelo maior resto (empate: a parcela mais cedo na lista). A soma é exata.
 */
const ZERO = BigInt(0);

export function reproporcionarParcelas(parcelas: ParcelaAdicional[], novoTotal: Centavos): ParcelaAdicional[] {
  if (parcelas.length === 0) return [];
  const soma = parcelas.reduce((s, x) => s + BigInt(x.valor), ZERO);
  const total = BigInt(novoTotal);
  const base = parcelas.map((x) => (soma === ZERO ? total / BigInt(parcelas.length) : (total * BigInt(x.valor)) / soma));
  const resto = parcelas.map((x) =>
    soma === ZERO ? total % BigInt(parcelas.length) : (total * BigInt(x.valor)) % soma,
  );
  let faltam = Number(total - base.reduce((s, v) => s + v, ZERO));
  const ordem = parcelas
    .map((_, i) => i)
    .sort((a, b) => (resto[a] === resto[b] ? a - b : resto[a] > resto[b] ? -1 : 1));
  const valores = base.map(Number);
  for (const i of ordem) {
    if (faltam <= 0) break;
    valores[i] += 1;
    faltam -= 1;
  }
  return parcelas.map((x, i) => ({ ...x, valor: valores[i] }));
}

export function previaReajusteContratos(contratos: ContratoParaReajuste[], pct: number): PreviaContrato[] {
  return contratos
    .filter((c) => c.honorario !== null)
    .map((c) => {
      const parcelaPara = reajustar(c.parcela_adicional_total, pct);
      return {
        contratoId: c.id,
        honorarioDe: c.honorario as Centavos,
        honorarioPara: reajustar(c.honorario as Centavos, pct),
        parcelaDe: c.parcela_adicional_total,
        parcelaPara,
        parcelas: reproporcionarParcelas(c.parcelas, parcelaPara),
      };
    });
}

export function reajustarTabelaExtras(
  servicos: { id: string; valor: Centavos }[],
  pct: number,
): { id: string; de: Centavos; para: Centavos }[] {
  return servicos.map((s) => ({ id: s.id, de: s.valor, para: arredondarParaCimaReal(reajustar(s.valor, pct)) }));
}
