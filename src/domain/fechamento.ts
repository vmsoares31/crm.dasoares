import { dataVencimento } from "./datas";
import { montarDescricao } from "./descricao";
import type {
  Centavos, Competencia, DataISO, ItemCobranca, ParcelaAdicional, TipoCobranca,
} from "./tipos";

export interface ContratoFechamento {
  clienteId: string; contratoId: string; clienteNome: string;
  honorario: Centavos | null; diaVencimento: number | null;
  carteiraId: string | null; tipoCobranca: TipoCobranca | null;
  parcelas: (ParcelaAdicional & { id: string })[];
}
export interface ExtraPendente { id: string; clienteId: string; descricao: string; valor: Centavos }
export interface EntradaFechamento {
  competencia: Competencia; contratos: ContratoFechamento[];
  extras: ExtraPendente[]; saldoCredito: Record<string, Centavos>;
}
export interface CobrancaMontada {
  clienteId: string; contratoId: string; origem: "mensal" | "parcela_avulsa";
  parcelaId: string | null; vencimento: DataISO; itens: ItemCobranca[]; total: Centavos;
  situacao: "prevista" | "quitada_por_credito"; creditoUsado: Centavos; descricao: string;
}
export interface ResultadoFechamento {
  cobrancas: CobrancaMontada[];
  naoGerados: { clienteId: string; clienteNome: string; motivo: string }[];
}

const MINIMO_COBRANCA: Centavos = 2000;

function faltando(c: ContratoFechamento): string[] {
  const f: string[] = [];
  // honorário zero ou negativo é tratado como não informado (não gera cobrança de R$ 0)
  if (c.honorario === null || c.honorario <= 0) f.push("honorário");
  if (c.diaVencimento === null) f.push("dia de vencimento");
  if (c.carteiraId === null) f.push("carteira");
  if (c.tipoCobranca === null) f.push("tipo de cobrança");
  return f;
}

/** Parte do saldo de crédito a abater: nunca deixa a cobrança abaixo do mínimo, salvo quitação total. */
function descontoAplicavel(saldo: Centavos, total: Centavos): Centavos {
  let d = Math.min(Math.max(saldo, 0), total);
  if (d === total) return d;
  if (total - d < MINIMO_COBRANCA) d = Math.max(0, total - MINIMO_COBRANCA);
  return d;
}

export function montarCobrancasDoMes(entrada: EntradaFechamento): ResultadoFechamento {
  const mes = Number(entrada.competencia.split("-")[1]);
  const cobrancas: CobrancaMontada[] = [];
  const naoGerados: ResultadoFechamento["naoGerados"] = [];

  for (const c of entrada.contratos) {
    const falta = faltando(c);
    if (falta.length > 0) {
      naoGerados.push({ clienteId: c.clienteId, clienteNome: c.clienteNome, motivo: `Falta: ${falta.join(", ")}` });
      continue;
    }
    const parcelasDoMes = c.parcelas.filter((p) => p.mes === mes);

    const itens: ItemCobranca[] = [{ tipo: "mensalidade", descricao: "Mensalidade", valor: c.honorario! }];
    for (const e of entrada.extras) {
      if (e.clienteId === c.clienteId) itens.push({ tipo: "extra", descricao: e.descricao, valor: e.valor, refId: e.id });
    }
    for (const p of parcelasDoMes.filter((p) => p.forma === "junto_mensalidade")) {
      itens.push({ tipo: "parcela_adicional", descricao: "Parcela adicional", valor: p.valor, refId: p.id });
    }

    const bruto = itens.reduce((s, i) => s + i.valor, 0);
    const d = bruto > 0 ? descontoAplicavel(entrada.saldoCredito[c.clienteId] ?? 0, bruto) : 0;
    if (d > 0) itens.push({ tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -d });
    const total = bruto - d;

    cobrancas.push({
      clienteId: c.clienteId, contratoId: c.contratoId, origem: "mensal", parcelaId: null,
      vencimento: dataVencimento(entrada.competencia, c.diaVencimento),
      itens, total, creditoUsado: d,
      situacao: d > 0 && total === 0 ? "quitada_por_credito" : "prevista",
      descricao: montarDescricao(itens),
    });

    for (const p of parcelasDoMes.filter((p) => p.forma === "data_propria")) {
      const item: ItemCobranca = { tipo: "parcela_adicional", descricao: "Parcela adicional", valor: p.valor, refId: p.id };
      cobrancas.push({
        clienteId: c.clienteId, contratoId: c.contratoId, origem: "parcela_avulsa", parcelaId: p.id,
        vencimento: dataVencimento(entrada.competencia, p.dia),
        itens: [item], total: p.valor, creditoUsado: 0, situacao: "prevista",
        descricao: montarDescricao([item]),
      });
    }
  }
  return { cobrancas, naoGerados };
}
