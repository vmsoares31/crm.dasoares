import { describe, expect, it } from "vitest";

import { resumoFinanceiro, type CobrancaComItens } from "@/domain/painel";

const HOJE = "2027-01-20";

const base = { carteiraId: "c1", saldoDispensado: false, valorRecebido: 0 };

const cobrancas: CobrancaComItens[] = [
  // prevista: ainda não emitida
  { ...base, situacao: "prevista", total: 22000, vencimento: "2027-01-25", itens: [{ tipo: "mensalidade", valor: 22000 }] },
  // emitida e vencida: tudo em atraso
  { ...base, carteiraId: "c2", situacao: "emitida", total: 30000, vencimento: "2027-01-10", itens: [{ tipo: "mensalidade", valor: 30000 }] },
  // paga, com extra de 5000
  {
    ...base, situacao: "paga", total: 22000, valorRecebido: 22000, vencimento: "2027-01-05",
    itens: [{ tipo: "mensalidade", valor: 17000 }, { tipo: "extra", valor: 5000 }],
  },
  // paga parcialmente (10000 de 20000), com desconto de indicação de -15000, vencida
  {
    ...base, carteiraId: null, situacao: "paga_parcial", total: 20000, valorRecebido: 10000, vencimento: "2027-01-10",
    itens: [{ tipo: "mensalidade", valor: 35000 }, { tipo: "desconto_indicacao", valor: -15000 }],
  },
];

describe("resumoFinanceiro", () => {
  it("calcula cada total do mês", () => {
    const r = resumoFinanceiro(cobrancas, HOJE);
    expect(r.previsto).toBe(94000);
    expect(r.emitido).toBe(72000);
    expect(r.recebido).toBe(32000);
    expect(r.emAberto).toBe(40000);
    expect(r.atrasado).toBe(40000); // 30000 + saldo 10000
    expect(r.extras).toBe(5000);
    expect(r.parcelasAdicionais).toBe(0);
    expect(r.descontosIndicacao).toBe(15000);
    expect(r.naoEmitidas).toBe(1);
  });

  it("agrupa previsto e recebido por carteira", () => {
    const r = resumoFinanceiro(cobrancas, HOJE);
    expect(r.porCarteira).toEqual({
      c1: { previsto: 44000, recebido: 22000 },
      c2: { previsto: 30000, recebido: 0 },
      sem_carteira: { previsto: 20000, recebido: 10000 },
    });
  });

  it("não conta como atrasado o que ainda não venceu nem o saldo dispensado", () => {
    const r = resumoFinanceiro(
      [
        { ...base, situacao: "emitida", total: 30000, vencimento: HOJE, itens: [] },
        { ...base, situacao: "paga_parcial", total: 20000, valorRecebido: 5000, saldoDispensado: true, vencimento: "2027-01-01", itens: [] },
      ],
      HOJE,
    );
    expect(r.emAberto).toBe(30000);
    expect(r.atrasado).toBe(0);
  });

  it("ignora canceladas e conta quitada por crédito no previsto, sem emitir nem receber", () => {
    const r = resumoFinanceiro(
      [
        { ...base, situacao: "cancelada", total: 99999, vencimento: "2027-01-01", itens: [{ tipo: "extra", valor: 99999 }] },
        { ...base, situacao: "quitada_por_credito", total: 0, vencimento: "2027-01-01", itens: [{ tipo: "mensalidade", valor: 8000 }, { tipo: "desconto_indicacao", valor: -8000 }] },
      ],
      HOJE,
    );
    expect(r.previsto).toBe(0);
    expect(r.emitido).toBe(0);
    expect(r.recebido).toBe(0);
    expect(r.extras).toBe(0);
    expect(r.descontosIndicacao).toBe(8000);
    expect(r.naoEmitidas).toBe(0);
  });
});
