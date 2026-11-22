export type Centavos = number;
export type Competencia = `${number}-${string}`;           // "2027-01"
export type DataISO = string;                              // "2027-01-20"
export type Regime = 'mei' | 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
export type TipoCobranca = 'boleto' | 'boleto_pix' | 'pix' | 'cartao';
export type SaidaCarteira = 'csv_cora' | 'lista_manual';
export type SituacaoCliente = 'a_revisar' | 'ativo' | 'inativo';
export type SituacaoContrato = 'em_negociacao' | 'fechado' | 'encerrado';
export type SituacaoCobranca = 'prevista' | 'emitida' | 'paga' | 'paga_parcial'
  | 'cancelada' | 'quitada_por_credito';                  // "atrasada" é derivada
export type TipoItem = 'mensalidade' | 'extra' | 'parcela_adicional' | 'desconto_indicacao';

export interface ParcelaAdicional { mes: number; valor: Centavos;
  forma: 'junto_mensalidade' | 'data_propria'; dia: number | null } // dia null = último dia
export interface ItemCobranca { tipo: TipoItem; descricao: string; valor: Centavos; refId?: string }
