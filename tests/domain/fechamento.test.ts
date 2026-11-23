import { describe, expect, it } from "vitest";
import { montarCobrancasDoMes, type ContratoFechamento, type EntradaFechamento } from "@/domain/fechamento";

const contrato = (o: Partial<ContratoFechamento> = {}): ContratoFechamento => ({
  clienteId: "c1", contratoId: "k1", clienteNome: "Cliente 1", honorario: 22000, diaVencimento: 20,
  carteiraId: "w1", tipoCobranca: "boleto", parcelas: [], ...o,
});
const entrada = (o: Partial<EntradaFechamento> = {}): EntradaFechamento => ({
  competencia: "2027-12", contratos: [contrato()], extras: [], saldoCredito: {}, ...o,
});

describe("montarCobrancasDoMes", () => {
  it("só mensalidade", () => {
    const r = montarCobrancasDoMes(entrada());
    expect(r.cobrancas).toHaveLength(1);
    expect(r.cobrancas[0]).toMatchObject({ total: 22000, vencimento: "2027-12-20", origem: "mensal", situacao: "prevista", creditoUsado: 0 });
  });
  it("com extra", () => {
    const r = montarCobrancasDoMes(entrada({ extras: [{ id: "e1", clienteId: "c1", descricao: "Recálculo de guia", valor: 5000 }] }));
    expect(r.cobrancas[0].itens.map((i) => i.tipo)).toEqual(["mensalidade", "extra"]);
    expect(r.cobrancas[0].total).toBe(27000);
  });
  it("parcela junto da mensalidade", () => {
    const r = montarCobrancasDoMes(entrada({ contratos: [contrato({ parcelas: [{ id: "p1", mes: 12, valor: 25000, forma: "junto_mensalidade", dia: null }] })] }));
    expect(r.cobrancas[0].itens.map((i) => i.tipo)).toContain("parcela_adicional");
    expect(r.cobrancas[0].total).toBe(47000);
  });
  it("parcela com data própria gera cobrança avulsa", () => {
    const r = montarCobrancasDoMes(entrada({ competencia: "2027-11", contratos: [contrato({ parcelas: [{ id: "p1", mes: 11, valor: 12500, forma: "data_propria", dia: null }] })] }));
    expect(r.cobrancas).toHaveLength(2);
    expect(r.cobrancas[1]).toMatchObject({ origem: "parcela_avulsa", parcelaId: "p1", vencimento: "2027-11-30", total: 12500 });
  });
  it("ignora parcela de outro mês", () => {
    const r = montarCobrancasDoMes(entrada({ contratos: [contrato({ parcelas: [{ id: "p1", mes: 11, valor: 12500, forma: "junto_mensalidade", dia: null }] })] }));
    expect(r.cobrancas[0].total).toBe(22000);
  });
  it("desconto de indicação", () => {
    const c = montarCobrancasDoMes(entrada({ saldoCredito: { c1: 15000 } })).cobrancas[0];
    expect(c.itens.at(-1)).toMatchObject({ tipo: "desconto_indicacao", valor: -15000 });
    expect(c).toMatchObject({ total: 7000, creditoUsado: 15000 });
  });
  it("saldo maior que o total quita por crédito", () => {
    expect(montarCobrancasDoMes(entrada({ saldoCredito: { c1: 30000 } })).cobrancas[0])
      .toMatchObject({ total: 0, situacao: "quitada_por_credito", creditoUsado: 22000 });
  });
  it("respeita o mínimo de R$ 20,00 (saldo 21000, total 22000)", () => {
    expect(montarCobrancasDoMes(entrada({ saldoCredito: { c1: 21000 } })).cobrancas[0])
      .toMatchObject({ creditoUsado: 20000, total: 2000 });
  });
  it("honorário baixo não usa crédito", () => {
    const c = montarCobrancasDoMes(entrada({ contratos: [contrato({ honorario: 1500 })], saldoCredito: { c1: 1000 } })).cobrancas[0];
    expect(c).toMatchObject({ creditoUsado: 0, total: 1500 });
    expect(c.itens.some((i) => i.tipo === "desconto_indicacao")).toBe(false);
  });
  it("contrato sem carteira vai para naoGerados", () => {
    const r = montarCobrancasDoMes(entrada({ contratos: [contrato({ carteiraId: null })] }));
    expect(r.cobrancas).toHaveLength(0);
    expect(r.naoGerados[0].motivo).toContain("carteira");
  });
});
