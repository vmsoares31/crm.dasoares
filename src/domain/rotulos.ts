import type { Regime, SituacaoCliente, TipoCobranca } from "./tipos";

export const ROTULOS_REGIME: Record<Regime, string> = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

export const ROTULOS_TIPO_COBRANCA: Record<TipoCobranca, string> = {
  boleto: "Boleto",
  boleto_pix: "Boleto + Pix",
  pix: "Pix",
  cartao: "Cartão",
};

export const ROTULOS_SITUACAO_CLIENTE: Record<SituacaoCliente, string> = {
  a_revisar: "A revisar",
  ativo: "Ativo",
  inativo: "Inativo",
};
