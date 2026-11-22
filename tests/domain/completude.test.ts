import { describe, expect, it } from "vitest";

import { pendenciasCadastro, type ClienteCompleto } from "@/domain/completude";

const base = {
  id: "c1", documento: "11222333000181", email: "a@b.com", regime: "simples_nacional",
} as unknown as ClienteCompleto;

function completo(): ClienteCompleto {
  return {
    ...base,
    socios: [{ id: "s1", administrador: true }],
    contrato: {
      id: "k1", honorario: 50000, dia_vencimento: 10, carteira_id: "w1",
      tipo_cobranca: "boleto", email_cobranca: "x@y.com",
    },
  } as unknown as ClienteCompleto;
}

describe("pendenciasCadastro", () => {
  it("cliente sem contrato", () => {
    const p = pendenciasCadastro({ ...base, socios: [], contrato: null });
    expect(p).toEqual(expect.arrayContaining(["honorario", "vencimento", "carteira", "tipo_cobranca"]));
  });
  it("sem sócio administrador", () => {
    const c = completo();
    c.socios = [{ id: "s", administrador: false } as never];
    expect(pendenciasCadastro(c)).toEqual(["socio_administrador"]);
  });
  it("tudo preenchido", () => expect(pendenciasCadastro(completo())).toEqual([]));
  it("CNPJ inválido", () => {
    const c = completo();
    c.documento = "11222333000180";
    expect(pendenciasCadastro(c)).toContain("documento_invalido");
  });
  it("CPF válido não é inválido", () => {
    const c = completo();
    c.documento = "52998224725";
    expect(pendenciasCadastro(c)).toEqual([]);
  });
  it("documento ausente é inválido", () => {
    const c = completo();
    c.documento = null;
    expect(pendenciasCadastro(c)).toContain("documento_invalido");
  });
  it("honorário 0 é valor válido, não pendência", () => {
    const c = completo();
    c.contrato!.honorario = 0;
    expect(pendenciasCadastro(c)).toEqual([]);
  });
  it("sem regime", () => {
    const c = completo();
    c.regime = null;
    expect(pendenciasCadastro(c)).toEqual(["regime"]);
  });
  it("sem e-mail em lugar nenhum", () => {
    const c = completo();
    c.email = " ";
    c.contrato!.email_cobranca = null;
    expect(pendenciasCadastro(c)).toEqual(["email"]);
  });
  it("e-mail só no cliente basta", () => {
    const c = completo();
    c.contrato!.email_cobranca = null;
    expect(pendenciasCadastro(c)).toEqual([]);
  });
  it("honorário nulo gera pendência de honorário", () => {
    const c = completo();
    c.contrato!.honorario = null;
    expect(pendenciasCadastro(c)).toEqual(["honorario"]);
  });
});
