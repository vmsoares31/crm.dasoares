import type { Centavos, DataISO } from "./tipos";

const DIA_MS = 86_400_000;
const DOIS = BigInt(2);

function utc(d: DataISO): number {
  const [a, m, dia] = d.split("-").map(Number);
  return Date.UTC(a, m - 1, dia);
}

/** Dias corridos de `de` até `ate` (negativo se `ate` vier antes). */
export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((utc(ate) - utc(de)) / DIA_MS);
}

/** Percentual em centésimos de ponto (2 → 200; 1.5 → 150), evitando erro de float. */
function pontosBase(pct: number): bigint {
  return BigInt(Math.round(pct * 100));
}

/** a / b arredondado ao inteiro, meio para cima (a, b ≥ 0). */
function dividirArredondando(a: bigint, b: bigint): number {
  return Number((a * DOIS + b) / (b * DOIS));
}

/**
 * Valor atualizado de uma cobrança vencida (§6.7): multa fixa de `multaPct`% + juros de
 * `jurosMesPct`% ao mês pró-rata dia (`valor × jurosMes × dias / 30`).
 * Arredondamento: multa e juros calculados separadamente, cada um ao centavo, meio para cima.
 * Até o dia do vencimento (inclusive) não há encargos.
 */
export function valorAtualizado(
  valor: Centavos,
  vencimento: DataISO,
  hoje: DataISO,
  multaPct: number,
  jurosMesPct: number,
): { multa: Centavos; juros: Centavos; total: Centavos; diasAtraso: number } {
  const diasAtraso = Math.max(0, diasEntre(vencimento, hoje));
  if (diasAtraso === 0 || valor <= 0) return { multa: 0, juros: 0, total: valor, diasAtraso };
  const v = BigInt(valor);
  const multa = dividirArredondando(v * pontosBase(multaPct), BigInt(10_000));
  const juros = dividirArredondando(v * pontosBase(jurosMesPct) * BigInt(diasAtraso), BigInt(300_000));
  return { multa, juros, total: valor + multa + juros, diasAtraso };
}

export type GrupoInadimplencia<T> = { clienteId: string; clienteNome: string; total: Centavos; itens: T[] };

/** Agrupa linhas de inadimplência por cliente, com o total devido; maior devedor primeiro. */
export function agruparInadimplencia<T extends { clienteId: string; clienteNome: string; total: Centavos }>(
  linhas: T[],
): GrupoInadimplencia<T>[] {
  const grupos = new Map<string, GrupoInadimplencia<T>>();
  for (const l of linhas) {
    const g = grupos.get(l.clienteId) ?? { clienteId: l.clienteId, clienteNome: l.clienteNome, total: 0, itens: [] };
    g.total += l.total;
    g.itens.push(l);
    grupos.set(l.clienteId, g);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total || a.clienteNome.localeCompare(b.clienteNome, "pt-BR"));
}
