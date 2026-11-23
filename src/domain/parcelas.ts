import { formatarBRL } from "./dinheiro";
import { valorPorExtenso } from "./extenso";
import type { Centavos, ParcelaAdicional } from "./tipos";

export type AtalhoParcelas = "unica_dezembro" | "2x_nov_ultimo_dia_dez" | "2x_junto_nov_dez";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const ORDINAIS_F = ["primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima", "oitava", "nona", "décima", "décima primeira", "décima segunda"];
const CARDINAIS_F = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze"];

/** Divide o total em 2 parcelas; o centavo ímpar fica na primeira. */
function dividirEmDois(total: Centavos): [Centavos, Centavos] {
  const segunda = Math.floor(total / 2);
  return [total - segunda, segunda];
}

export function atalhoParcelas(atalho: AtalhoParcelas, total: Centavos): ParcelaAdicional[] {
  if (atalho === "unica_dezembro") {
    return [{ mes: 12, valor: total, forma: "junto_mensalidade", dia: null }];
  }
  const [a, b] = dividirEmDois(total);
  return [
    { mes: 11, valor: a, forma: atalho === "2x_nov_ultimo_dia_dez" ? "data_propria" : "junto_mensalidade", dia: null },
    { mes: 12, valor: b, forma: "junto_mensalidade", dia: null },
  ];
}

export function validarParcelas(parcelas: ParcelaAdicional[], total: Centavos): string[] {
  const erros: string[] = [];
  const add = (e: string) => { if (!erros.includes(e)) erros.push(e); };

  const meses = new Set<number>();
  for (const p of parcelas) {
    if (!Number.isInteger(p.mes) || p.mes < 1 || p.mes > 12) add("Mês inválido");
    if (meses.has(p.mes)) add("Há mais de uma parcela no mesmo mês");
    meses.add(p.mes);
    if (!Number.isInteger(p.valor) || p.valor <= 0) add("O valor de cada parcela deve ser maior que zero");
    if (p.dia !== null && (!Number.isInteger(p.dia) || p.dia < 1 || p.dia > 31)) add("Dia inválido");
  }
  const soma = parcelas.reduce((s, p) => s + p.valor, 0);
  if (soma !== total) add("Soma das parcelas difere do valor total");
  return erros;
}

function valorComExtenso(c: Centavos): string {
  return `${formatarBRL(c)} (${valorPorExtenso(c)})`;
}

function diaDaParcela(p: ParcelaAdicional, diaVencimento: number): string {
  const mes = MESES[p.mes - 1];
  if (p.forma === "junto_mensalidade") return `até o dia ${diaVencimento} de ${mes}`;
  return p.dia === null ? `no último dia do mês de ${mes}` : `no dia ${p.dia} de ${mes}`;
}

/** Texto da cláusula 4.7 conforme as parcelas cadastradas. */
export function textoParcelaAdicional(parcelas: ParcelaAdicional[], diaVencimento: number): string {
  if (parcelas.length === 0) return "";
  const ord = [...parcelas].sort((a, b) => a.mes - b.mes);
  const juntamente = ord.some((p) => p.forma === "junto_mensalidade") ? ", juntamente com os honorários mensais" : "";

  if (ord.length === 1) {
    const [p] = ord;
    const mes = MESES[p.mes - 1];
    const quando = p.forma === "junto_mensalidade"
      ? `até o dia ${diaVencimento} daquele mês`
      : p.dia === null ? "no último dia daquele mês" : `no dia ${p.dia} daquele mês`;
    return `no mês de ${mes} de cada ano, a ser pago ${quando}${juntamente}, uma parcela adicional, no valor inicial de ${valorComExtenso(p.valor)}`;
  }

  const n = ord.length;
  const total = ord.reduce((s, p) => s + p.valor, 0);
  const partes = ord.map((p, i) => `a ${ORDINAIS_F[i]} ${diaDaParcela(p, diaVencimento)}`);
  const quando = partes.length === 2
    ? `${partes[0]} e ${partes[1]}`
    : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  const iguais = ord.every((p) => p.valor === ord[0].valor);
  const sendo = iguais
    ? `${valorComExtenso(ord[0].valor)} cada parcela`
    : ord.map((p, i) => `${valorComExtenso(p.valor)} a ${ORDINAIS_F[i]}`).join(", ").replace(/, ([^,]*)$/, " e $1");
  return `em ${n} (${CARDINAIS_F[n] ?? n}) parcelas anuais, ${quando}${juntamente}, uma parcela adicional, no valor inicial total de ${valorComExtenso(total)}, sendo ${sendo}`;
}
