import { formatarData } from "./datas";
import { formatarValorCora } from "./dinheiro";
import { somenteDigitos } from "./documentos";
import type { Centavos, DataISO, SaidaCarteira, TipoCobranca } from "./tipos";

// Constantes do formato do arquivo de emissão em lote do Cora (ajustar só aqui).
export const CORA_SEPARADOR = ";";
export const CORA_QUEBRA_LINHA = "\r\n";
export const CORA_BOM = "\uFEFF";
export const CORA_CABECALHO = [
  "nome_do_pagador", "cpf_cnpj", "valor", "vencimento", "nome_cobranca", "descricao",
  "tipo_cobranca", "email", "notificar_em", "multa", "juros_mensal", "desconto", "desconto_valido_ate",
] as const;
export const CORA_VALOR_MINIMO: Centavos = 2000;
export const CORA_DIAS_VENCIMENTO_SUGERIDO = 3;

export type LinhaCora = {
  cobrancaId: string; nomePagador: string; documento: string; valor: Centavos; vencimento: DataISO;
  nomeCobranca: string; descricao: string; tipo: TipoCobranca; email: string; notificarEm: string;
  multaPct: number; jurosPct: number;
};

export type ErroLinhaCora = { cobrancaId: string; erro: string };

function campo(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function pct(n: number): string {
  return `${String(n).replace(".", ",")}%`;
}

function validar(l: LinhaCora, hoje: DataISO): string | null {
  if (l.tipo === "cartao") return "Cartão não vai ao arquivo do Cora";
  if (l.valor < CORA_VALOR_MINIMO) return "Valor abaixo de R$ 20,00";
  if (l.vencimento < hoje) return "Vencimento no passado";
  return null;
}

export function gerarCsvCora(linhas: LinhaCora[], hoje: DataISO): { csv: string; erros: ErroLinhaCora[] } {
  const erros: ErroLinhaCora[] = [];
  const registros: string[] = [CORA_CABECALHO.join(CORA_SEPARADOR)];
  for (const l of linhas) {
    const erro = validar(l, hoje);
    if (erro) {
      erros.push({ cobrancaId: l.cobrancaId, erro });
      continue;
    }
    registros.push([
      l.nomePagador, somenteDigitos(l.documento), formatarValorCora(l.valor), formatarData(l.vencimento),
      l.nomeCobranca, l.descricao, l.tipo, l.email, l.notificarEm, pct(l.multaPct), pct(l.jurosPct), "", "",
    ].map(campo).join(CORA_SEPARADOR));
  }
  return { csv: CORA_BOM + registros.join(CORA_QUEBRA_LINHA) + CORA_QUEBRA_LINHA, erros };
}

export function sugerirVencimento(hoje: DataISO): DataISO {
  const [a, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + CORA_DIAS_VENCIMENTO_SUGERIDO)).toISOString().slice(0, 10);
}

/** Cartão, ou carteira de lista manual (ou sem carteira), vai para a lista manual; o resto, ao Cora. */
export function separarPorSaida<T extends { carteiraId: string | null; tipo: TipoCobranca | null }>(
  cobrancas: T[],
  carteiras: { id: string; saida: SaidaCarteira }[],
): { cora: T[]; manual: T[] } {
  const saida = new Map(carteiras.map((c) => [c.id, c.saida]));
  const cora: T[] = [];
  const manual: T[] = [];
  for (const c of cobrancas) {
    const s = c.carteiraId ? saida.get(c.carteiraId) : undefined;
    (c.tipo === "cartao" || s !== "csv_cora" ? manual : cora).push(c);
  }
  return { cora, manual };
}
