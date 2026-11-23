import { describe, expect, it } from "vitest";
import { montarDescricao } from "@/domain/descricao";

describe("montarDescricao", () => {
  it("junta itens com + e − (desconto)", () => {
    expect(montarDescricao([
      { tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 },
      { tipo: "extra", descricao: "Recálculo de guia", valor: 5000 },
      { tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -15000 },
    ])).toBe("Mensalidade R$ 220,00 + Recálculo de guia R$ 50,00 − Desconto indicação R$ 150,00");
  });
  it("item único", () => {
    expect(montarDescricao([{ tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 }])).toBe("Mensalidade R$ 220,00");
  });
});
