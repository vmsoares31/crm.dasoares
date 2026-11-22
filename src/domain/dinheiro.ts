import type { Centavos } from "./tipos";

function numeroBR(c: Centavos): string {
  const abs = Math.abs(Math.round(c));
  const inteiro = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = (abs % 100).toString().padStart(2, "0");
  return `${inteiro},${cents}`;
}

export function formatarBRL(c: Centavos): string {
  return `${c < 0 ? "-" : ""}R$ ${numeroBR(c)}`;
}

/** Valor para o CSV da Cora: sem símbolo nem separador de milhar. */
export function formatarValorCora(c: Centavos): string {
  return numeroBR(c).replace(/\./g, "");
}

export function parseBRL(s: string): Centavos {
  const neg = /^\s*-/.test(s);
  const limpo = s.replace(/[^\d,]/g, "");
  const [int = "0", dec = ""] = limpo.split(",");
  const cents = Number(int || "0") * 100 + Number((dec + "00").slice(0, 2));
  return neg ? -cents : cents;
}

export function arredondarParaCimaReal(c: Centavos): Centavos {
  return Math.ceil(c / 100) * 100;
}

/** Aplica pct (ex.: 5.5) arredondando meio para cima ao centavo. */
export function aplicarPercentual(c: Centavos, pct: number): Centavos {
  // pct em centésimos de ponto percentual evita erro de float (5.5 -> 550)
  const bp = Math.round(pct * 100);
  return Math.floor((c * bp + 5000) / 10000);
}
