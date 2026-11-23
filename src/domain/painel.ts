import type { Centavos, DataISO, SituacaoCobranca, TipoItem } from "./tipos";

export interface CobrancaComItens {
  situacao: SituacaoCobranca;
  /** Total da cobrança (já líquido de descontos de indicação). */
  total: Centavos;
  /** Soma dos pagamentos registrados da cobrança (`cobrancas.valor_recebido`). */
  valorRecebido: Centavos;
  saldoDispensado: boolean;
  vencimento: DataISO;
  /** Carteira do contrato; null = sem carteira. */
  carteiraId: string | null;
  itens: { tipo: TipoItem; valor: Centavos }[];
}

export interface ResumoFinanceiro {
  previsto: Centavos;
  emitido: Centavos;
  recebido: Centavos;
  emAberto: Centavos;
  atrasado: Centavos;
  extras: Centavos;
  descontosIndicacao: Centavos;
  parcelasAdicionais: Centavos;
  naoEmitidas: number;
  porCarteira: Record<string, { previsto: Centavos; recebido: Centavos }>;
}

/** Chave de `porCarteira` para cobranças de contratos sem carteira. */
export const SEM_CARTEIRA = "sem_carteira";

/**
 * Totais de uma competência. Cobranças `cancelada` são ignoradas em tudo.
 * - previsto: soma dos `total` de todas as cobranças não canceladas (prevista, emitida, paga,
 *   paga_parcial e quitada_por_credito; esta última entra pelo seu total, normalmente 0,
 *   pois o crédito já abateu o valor).
 * - emitido: soma dos `total` das cobranças já emitidas (emitida, paga, paga_parcial);
 *   prevista e quitada_por_credito não contam.
 * - recebido: soma de `valorRecebido` (pagamentos registrados) das cobranças não canceladas.
 * - emAberto: saldo (total − recebido, mínimo 0) das cobranças emitida/paga_parcial sem saldo dispensado.
 * - atrasado: parte do emAberto cujo vencimento é anterior a `hoje` (mesma regra de `v_cobrancas.atrasada`).
 * - extras / parcelasAdicionais: soma dos itens desses tipos; descontosIndicacao: soma em módulo
 *   dos itens `desconto_indicacao` (valor positivo).
 * - naoEmitidas: quantidade de cobranças ainda `prevista`.
 * - porCarteira: previsto e recebido agrupados pela carteira (`SEM_CARTEIRA` quando não há).
 */
export function resumoFinanceiro(cobrancas: CobrancaComItens[], hoje: DataISO): ResumoFinanceiro {
  const r: ResumoFinanceiro = {
    previsto: 0, emitido: 0, recebido: 0, emAberto: 0, atrasado: 0,
    extras: 0, descontosIndicacao: 0, parcelasAdicionais: 0, naoEmitidas: 0, porCarteira: {},
  };
  for (const c of cobrancas) {
    if (c.situacao === "cancelada") continue;
    r.previsto += c.total;
    r.recebido += c.valorRecebido;
    if (c.situacao === "prevista") r.naoEmitidas += 1;
    if (c.situacao === "emitida" || c.situacao === "paga" || c.situacao === "paga_parcial") r.emitido += c.total;
    if ((c.situacao === "emitida" || c.situacao === "paga_parcial") && !c.saldoDispensado) {
      const saldo = Math.max(0, c.total - c.valorRecebido);
      r.emAberto += saldo;
      if (c.vencimento < hoje) r.atrasado += saldo;
    }
    for (const i of c.itens) {
      if (i.tipo === "extra") r.extras += i.valor;
      else if (i.tipo === "parcela_adicional") r.parcelasAdicionais += i.valor;
      else if (i.tipo === "desconto_indicacao") r.descontosIndicacao += Math.abs(i.valor);
    }
    const chave = c.carteiraId ?? SEM_CARTEIRA;
    const g = (r.porCarteira[chave] ??= { previsto: 0, recebido: 0 });
    g.previsto += c.total;
    g.recebido += c.valorRecebido;
  }
  return r;
}
