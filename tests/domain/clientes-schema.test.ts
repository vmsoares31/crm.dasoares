import { describe, expect, it } from "vitest";

import { clienteSchema, linhaMassaSchema, socioSchema } from "@/domain/clientes-schema";

const vazio = {
  razao_social: "ACME", nome_fantasia: "", documento: "", codigo_dominio: "", logradouro: "", numero: "",
  complemento: "", bairro: "", cidade: "", uf: "", cep: "", telefone: "", email: "",
  inscricao_estadual: "", inscricao_municipal: "", regime: "", observacoes: "",
};

describe("clienteSchema", () => {
  it("guarda só dígitos do documento", () => {
    const r = clienteSchema.parse({ ...vazio, documento: "11.222.333/0001-81" });
    expect(r.documento).toBe("11222333000181");
  });
  it("rejeita documento inválido", () => {
    expect(clienteSchema.safeParse({ ...vazio, documento: "11.222.333/0001-80" }).success).toBe(false);
  });
  it("vazios viram null", () => {
    const r = clienteSchema.parse(vazio);
    expect(r.documento).toBeNull();
    expect(r.regime).toBeNull();
  });
  it("exige razão social", () => {
    expect(clienteSchema.safeParse({ ...vazio, razao_social: " " }).success).toBe(false);
  });
});

describe("socioSchema", () => {
  it("valida CPF e participação", () => {
    expect(socioSchema.safeParse({ nome: "A", cpf: "529.982.247-25", participacao: "50,5", administrador: true }).success).toBe(true);
    expect(socioSchema.safeParse({ nome: "A", cpf: "111", participacao: "", administrador: false }).success).toBe(false);
    expect(socioSchema.safeParse({ nome: "A", cpf: "", participacao: "150", administrador: false }).success).toBe(false);
  });
});

describe("linhaMassaSchema", () => {
  const l = { clienteId: "123e4567-e89b-42d3-a456-426614174000", regime: "", honorario: "R$ 1.234,50", dia_vencimento: "10", carteira_id: "", tipo_cobranca: "", email_cobranca: "" };
  it("converte honorário em centavos", () => {
    expect(linhaMassaSchema.parse(l).honorario).toBe(123450);
  });
  it("rejeita clienteId que não é UUID", () => {
    expect(linhaMassaSchema.safeParse({ ...l, clienteId: "abc" }).success).toBe(false);
  });
  it("dia fora de 1–31", () => {
    expect(linhaMassaSchema.safeParse({ ...l, dia_vencimento: "32" }).success).toBe(false);
    expect(linhaMassaSchema.safeParse({ ...l, dia_vencimento: "0" }).success).toBe(false);
  });
});
