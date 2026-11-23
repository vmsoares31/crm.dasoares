import { describe, expect, it } from "vitest";

import { contratoElegivel, parsePercentual, validarLimiteReajuste, previaReajusteContratos, reajustarTabelaExtras, reproporcionarParcelas } from "@/domain/reajuste";
import type { ParcelaAdicional } from "@/domain/tipos";

const p = (mes: number, valor: number): ParcelaAdicional => ({ mes, valor, forma: "junto_mensalidade", dia: null });

describe("reajustarTabelaExtras", () => {
  it("arredonda para cima ao real", () => {
    expect(reajustarTabelaExtras([{ id: "a", valor: 5000 }], 4.75)).toEqual([{ id: "a", de: 5000, para: 5300 }]);
  });
  it("valor já inteiro não sobe", () => {
    expect(reajustarTabelaExtras([{ id: "a", valor: 10000 }], 5)[0].para).toBe(10500);
  });
});

describe("reproporcionarParcelas", () => {
  it("mantém a soma em divisão desigual (3 parcelas)", () => {
    const r = reproporcionarParcelas([p(10, 10000), p(11, 10000), p(12, 10000)], 10001);
    expect(r.map((x) => x.valor)).toEqual([3334, 3334, 3333]);
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(10001);
  });
  it("proporcional a valores diferentes, soma exata", () => {
    const r = reproporcionarParcelas([p(11, 15000), p(12, 10000)], 26251);
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(26251);
    expect(r.map((x) => x.mes)).toEqual([11, 12]);
  });
  it("sem parcelas devolve vazio; preserva forma e dia", () => {
    expect(reproporcionarParcelas([], 100)).toEqual([]);
    const r = reproporcionarParcelas([{ mes: 11, valor: 100, forma: "data_propria", dia: 5 }], 200);
    expect(r).toEqual([{ mes: 11, valor: 200, forma: "data_propria", dia: 5 }]);
  });
  it("determinístico", () => {
    const e = [p(10, 3333), p(11, 3333), p(12, 3334)];
    expect(reproporcionarParcelas(e, 7001)).toEqual(reproporcionarParcelas(e, 7001));
  });
});

describe("previaReajusteContratos", () => {
  it("honorário e parcela 2x", () => {
    const [r] = previaReajusteContratos(
      [{ id: "c1", honorario: 22000, parcela_adicional_total: 25000, parcelas: [p(11, 12500), p(12, 12500)] }],
      5,
    );
    expect(r).toMatchObject({ contratoId: "c1", honorarioDe: 22000, honorarioPara: 23100, parcelaDe: 25000, parcelaPara: 26250 });
    expect(r.parcelas.map((x) => x.valor)).toEqual([13125, 13125]);
  });
  it("ignora contrato sem honorário", () => {
    expect(previaReajusteContratos([{ id: "c", honorario: null, parcela_adicional_total: 0, parcelas: [] }], 5)).toEqual([]);
  });
  it("sem parcela adicional fica zero", () => {
    const [r] = previaReajusteContratos([{ id: "c", honorario: 10000, parcela_adicional_total: 0, parcelas: [] }], 5);
    expect(r.parcelaPara).toBe(0);
  });
});

describe("parsePercentual", () => {
  it("aceita vírgula", () => expect(parsePercentual("4,75")).toBe(4.75));
  it("rejeita inválidos", () => {
    expect(parsePercentual("")).toBeNull();
    expect(parsePercentual("abc")).toBeNull();
    expect(parsePercentual("0")).toBeNull();
    expect(parsePercentual("150")).toBeNull();
  });
});

describe("contratoElegivel", () => {
  it("exige não encerrado e honorário", () => {
    expect(contratoElegivel("fechado", 100)).toBe(true);
    expect(contratoElegivel("encerrado", 100)).toBe(false);
    expect(contratoElegivel("fechado", null)).toBe(false);
  });
});

describe("validarLimiteReajuste", () => {
  it("aceita de 1x a 3x", () => {
    expect(validarLimiteReajuste(1000, 1000, "H")).toBeNull();
    expect(validarLimiteReajuste(1000, 3000, "H")).toBeNull();
  });
  it("rejeita menor, acima de 3x, zero e não seguro", () => {
    expect(validarLimiteReajuste(1000, 999, "H")).not.toBeNull();
    expect(validarLimiteReajuste(1000, 3001, "H")).not.toBeNull();
    expect(validarLimiteReajuste(1000, 0, "H")).not.toBeNull();
    expect(validarLimiteReajuste(1000, Number.MAX_SAFE_INTEGER + 2, "H")).not.toBeNull();
    expect(validarLimiteReajuste(1000, 1000.5, "H")).not.toBeNull();
  });
});
