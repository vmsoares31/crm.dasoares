import { describe, expect, it } from "vitest";

import { contratoSchema } from "@/domain/contrato-schema";

const base = {
  situacao: "fechado", honorario: "R$ 1.234,50", dia_vencimento: "20", data_inicio: "2027-01-01",
  carteira_id: "", tipo_cobranca: "boleto", email_cobranca: "a@b.com", parcela_adicional_total: "250,00",
  legado: false, encerrado_em: "", motivo: "", parcelas: "[]",
};

describe("contratoSchema", () => {
  it("converte valores para centavos e vazios para null", () => {
    const r = contratoSchema.parse(base);
    expect(r.honorario).toBe(123450);
    expect(r.parcela_adicional_total).toBe(25000);
    expect(r.carteira_id).toBeNull();
    expect(r.parcelas).toEqual([]);
  });

  it("encerrado exige data de encerramento", () => {
    const r = contratoSchema.safeParse({ ...base, situacao: "encerrado" });
    expect(r.success).toBe(false);
    expect(contratoSchema.safeParse({ ...base, situacao: "encerrado", encerrado_em: "2027-06-30" }).success).toBe(true);
  });

  it("rejeita dia fora de 1..31 e JSON de parcelas inválido", () => {
    expect(contratoSchema.safeParse({ ...base, dia_vencimento: "40" }).success).toBe(false);
    expect(contratoSchema.safeParse({ ...base, parcelas: "{x" }).success).toBe(false);
  });

  it("aponta a parcela com valor inválido", () => {
    const parcelas = JSON.stringify([
      { mes: 11, valor: 1000, forma: "junto_mensalidade", dia: null },
      { mes: 12, valor: null, forma: "junto_mensalidade", dia: null },
    ]);
    const r = contratoSchema.safeParse({ ...base, parcelas });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Parcela 2: valor inválido.");
  });

  it("aponta mês e dia inválidos da parcela", () => {
    const mes = JSON.stringify([{ mes: 13, valor: 100, forma: "junto_mensalidade", dia: null }]);
    const dia = JSON.stringify([{ mes: 12, valor: 100, forma: "data_propria", dia: 40 }]);
    const a = contratoSchema.safeParse({ ...base, parcelas: mes });
    const b = contratoSchema.safeParse({ ...base, parcelas: dia });
    expect(!a.success && a.error.issues[0].message).toBe("Parcela 1: mês inválido.");
    expect(!b.success && b.error.issues[0].message).toBe("Parcela 1: dia inválido.");
  });

  it("mantém o id das parcelas existentes e aceita parcelas novas sem id", () => {
    const id = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
    const parcelas = JSON.stringify([
      { id, mes: 11, valor: 12500, forma: "data_propria", dia: null },
      { mes: 12, valor: 12500, forma: "junto_mensalidade", dia: null },
    ]);
    const r = contratoSchema.parse({ ...base, parcelas });
    expect(r.parcelas[0]).toEqual({ id, mes: 11, valor: 12500, forma: "data_propria", dia: null });
    expect(r.parcelas[1]).not.toHaveProperty("id");
  });

  it("rejeita id de parcela inválido ou repetido", () => {
    const id = "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b";
    const invalido = JSON.stringify([{ id: "x", mes: 12, valor: 100, forma: "junto_mensalidade", dia: null }]);
    const repetido = JSON.stringify([
      { id, mes: 11, valor: 100, forma: "junto_mensalidade", dia: null },
      { id, mes: 12, valor: 100, forma: "junto_mensalidade", dia: null },
    ]);
    const a = contratoSchema.safeParse({ ...base, parcelas: invalido });
    const b = contratoSchema.safeParse({ ...base, parcelas: repetido });
    expect(!a.success && a.error.issues[0].message).toBe("Parcela 1: identificador inválido.");
    expect(!b.success && b.error.issues[0].message).toBe("Parcela 2: identificador inválido.");
  });

  it("rejeita honorário zero e aceita honorário vazio (em negociação)", () => {
    for (const honorario of ["0", "0,00", "R$ 0,00"]) {
      const r = contratoSchema.safeParse({ ...base, honorario });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("Informe um honorário maior que zero.");
    }
    expect(contratoSchema.parse({ ...base, situacao: "em_negociacao", honorario: "" }).honorario).toBeNull();
  });
});
