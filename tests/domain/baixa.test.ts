import { describe, expect, it } from "vitest";

import { acoesDaCobranca, validarBaixa } from "@/domain/baixa";

describe("acoesDaCobranca", () => {
  it("emitida: baixa e cancelar", () => {
    expect(acoesDaCobranca("emitida", false)).toEqual({ baixa: true, cancelar: true, dispensar: false });
  });
  it("paga_parcial: baixa e dispensar saldo, sem cancelar", () => {
    expect(acoesDaCobranca("paga_parcial", false)).toEqual({ baixa: true, cancelar: false, dispensar: true });
  });
  it("paga_parcial com saldo dispensado: nada", () => {
    expect(acoesDaCobranca("paga_parcial", true)).toEqual({ baixa: false, cancelar: false, dispensar: false });
  });
  it("prevista e quitada por crédito: só cancelar", () => {
    expect(acoesDaCobranca("prevista", false)).toEqual({ baixa: false, cancelar: true, dispensar: false });
    expect(acoesDaCobranca("quitada_por_credito", false)).toEqual({ baixa: false, cancelar: true, dispensar: false });
  });
  it("paga e cancelada: nada", () => {
    expect(acoesDaCobranca("paga", false)).toEqual({ baixa: false, cancelar: false, dispensar: false });
    expect(acoesDaCobranca("cancelada", false)).toEqual({ baixa: false, cancelar: false, dispensar: false });
  });
});

describe("validarBaixa", () => {
  const hoje = "2027-02-10";
  it("aceita data até hoje e valor positivo", () => {
    expect(validarBaixa("2027-02-10", 22000, hoje)).toBeNull();
    expect(validarBaixa("2027-01-05", 1, hoje)).toBeNull();
  });
  it("rejeita data futura, inválida e valor não positivo", () => {
    expect(validarBaixa("2027-02-11", 22000, hoje)).toBe("A data do pagamento não pode ser futura.");
    expect(validarBaixa("2027-02-31", 22000, hoje)).toBe("Data do pagamento inválida.");
    expect(validarBaixa("10/02/2027", 22000, hoje)).toBe("Data do pagamento inválida.");
    expect(validarBaixa("2027-02-10", 0, hoje)).toBe("Informe um valor recebido maior que zero.");
    expect(validarBaixa("2027-02-10", -5, hoje)).toBe("Informe um valor recebido maior que zero.");
  });
});
