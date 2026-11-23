import { describe, expect, it } from "vitest";

import { atalhoParcelas, textoParcelaAdicional, validarParcelas } from "@/domain/parcelas";

describe("atalhoParcelas", () => {
  it("única em dezembro", () => {
    expect(atalhoParcelas("unica_dezembro", 25000)).toEqual([
      { mes: 12, valor: 25000, forma: "junto_mensalidade", dia: null },
    ]);
  });

  it("2x novembro (último dia) + dezembro, centavo extra na 1ª", () => {
    expect(atalhoParcelas("2x_nov_ultimo_dia_dez", 25001)).toEqual([
      { mes: 11, valor: 12501, forma: "data_propria", dia: null },
      { mes: 12, valor: 12500, forma: "junto_mensalidade", dia: null },
    ]);
  });

  it("2x junto das mensalidades de novembro e dezembro", () => {
    expect(atalhoParcelas("2x_junto_nov_dez", 30000)).toEqual([
      { mes: 11, valor: 15000, forma: "junto_mensalidade", dia: null },
      { mes: 12, valor: 15000, forma: "junto_mensalidade", dia: null },
    ]);
  });
});

describe("validarParcelas", () => {
  it("aceita parcelas que somam o total", () => {
    expect(validarParcelas(atalhoParcelas("2x_junto_nov_dez", 30000), 30000)).toEqual([]);
  });

  it("acusa soma diferente do total", () => {
    const erros = validarParcelas([{ mes: 12, valor: 100, forma: "junto_mensalidade", dia: null }], 25000);
    expect(erros).toContain("Soma das parcelas difere do valor total");
  });

  it("acusa dois itens no mesmo mês", () => {
    const erros = validarParcelas(
      [
        { mes: 12, valor: 100, forma: "junto_mensalidade", dia: null },
        { mes: 12, valor: 100, forma: "data_propria", dia: 10 },
      ],
      200,
    );
    expect(erros).toContain("Há mais de uma parcela no mesmo mês");
  });

  it("acusa mês, valor e dia inválidos", () => {
    const erros = validarParcelas([{ mes: 13, valor: 0, forma: "data_propria", dia: 40 }], 0);
    expect(erros).toEqual(expect.arrayContaining(["Mês inválido", "O valor de cada parcela deve ser maior que zero", "Dia inválido"]));
  });

  it("lista vazia só é válida com total zero", () => {
    expect(validarParcelas([], 0)).toEqual([]);
    expect(validarParcelas([], 100)).toContain("Soma das parcelas difere do valor total");
  });
});

describe("textoParcelaAdicional", () => {
  it("parcela única junto com a mensalidade de dezembro", () => {
    expect(
      textoParcelaAdicional([{ mes: 12, valor: 25000, forma: "junto_mensalidade", dia: null }], 20),
    ).toBe(
      "no mês de dezembro de cada ano, a ser pago até o dia 20 daquele mês, juntamente com os honorários mensais, uma parcela adicional, no valor inicial de R$ 250,00 (duzentos e cinquenta reais)",
    );
  });

  it("2x: novembro no último dia + dezembro junto", () => {
    expect(textoParcelaAdicional(atalhoParcelas("2x_nov_ultimo_dia_dez", 30000), 20)).toBe(
      "em 2 (duas) parcelas anuais, a primeira no último dia do mês de novembro e a segunda até o dia 20 de dezembro, juntamente com os honorários mensais, uma parcela adicional, no valor inicial total de R$ 300,00 (trezentos reais), sendo R$ 150,00 (cento e cinquenta reais) cada parcela",
    );
  });

  it("2x junto das mensalidades de novembro e dezembro", () => {
    expect(textoParcelaAdicional(atalhoParcelas("2x_junto_nov_dez", 30000), 20)).toBe(
      "em 2 (duas) parcelas anuais, a primeira até o dia 20 de novembro e a segunda até o dia 20 de dezembro, juntamente com os honorários mensais, uma parcela adicional, no valor inicial total de R$ 300,00 (trezentos reais), sendo R$ 150,00 (cento e cinquenta reais) cada parcela",
    );
  });

  it("sem parcelas devolve texto vazio", () => {
    expect(textoParcelaAdicional([], 20)).toBe("");
  });
});
