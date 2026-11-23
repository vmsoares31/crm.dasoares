import { describe, expect, it } from "vitest";

import { agruparInadimplencia, diasEntre, valorAtualizado } from "@/domain/encargos";

describe("valorAtualizado", () => {
  it("no dia do vencimento não há encargos", () => {
    const r = valorAtualizado(22000, "2027-01-20", "2027-01-20", 2, 1);
    expect(r.total).toBe(22000);
    expect(r).toEqual({ multa: 0, juros: 0, total: 22000, diasAtraso: 0 });
  });

  it("30 dias de atraso: multa 2% e juros 1% a.m. pró-rata", () => {
    expect(valorAtualizado(22000, "2027-01-20", "2027-02-19", 2, 1)).toEqual({
      multa: 440, juros: 220, total: 22660, diasAtraso: 30,
    });
  });

  it("antes do vencimento não há encargos", () => {
    expect(valorAtualizado(22000, "2027-01-20", "2027-01-10", 2, 1)).toEqual({ multa: 0, juros: 0, total: 22000, diasAtraso: 0 });
  });

  it("1 dia de atraso: multa cheia e juros de 1/30 do mês, arredondado ao centavo (meio para cima)", () => {
    // juros = 22000 × 1% × 1/30 = 7,333… → 7
    expect(valorAtualizado(22000, "2027-01-20", "2027-01-21", 2, 1)).toEqual({ multa: 440, juros: 7, total: 22447, diasAtraso: 1 });
    // juros = 15000 × 1% × 1/30 = 5 exatos; 4500 × 1% × 1/30 = 1,5 → 2
    expect(valorAtualizado(4500, "2027-01-20", "2027-01-21", 2, 1).juros).toBe(2);
  });

  it("usa os percentuais informados (do escritório)", () => {
    expect(valorAtualizado(10000, "2027-01-01", "2027-01-31", 10, 3)).toEqual({ multa: 1000, juros: 300, total: 11300, diasAtraso: 30 });
    expect(valorAtualizado(10000, "2027-01-01", "2027-01-31", 0, 0)).toEqual({ multa: 0, juros: 0, total: 10000, diasAtraso: 30 });
  });

  it("atravessa meses e anos", () => {
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
    expect(valorAtualizado(22000, "2026-12-20", "2027-02-19", 2, 1).diasAtraso).toBe(61);
  });
});

describe("agruparInadimplencia", () => {
  it("agrupa por cliente com total devido, ordenando pelo maior total", () => {
    const g = agruparInadimplencia([
      { clienteId: "a", clienteNome: "Alfa", total: 100 },
      { clienteId: "b", clienteNome: "Beta", total: 500 },
      { clienteId: "a", clienteNome: "Alfa", total: 300 },
    ]);
    expect(g.map((x) => [x.clienteId, x.total, x.itens.length])).toEqual([["b", 500, 1], ["a", 400, 2]]);
  });
});
