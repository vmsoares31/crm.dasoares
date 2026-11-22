import { describe, expect, it } from "vitest";

import { carteiraSchema, escritorioSchema, servicoExtraSchema } from "@/domain/escritorio-schema";

const base = {
  razao_social: "D. A. SOARES CONTABILIDADE LTDA",
  cnpj: "01.496.613/0001-24",
  logradouro: "Rua Cantagalo",
  numero: "222",
  complemento: "1º andar",
  bairro: "Tatuapé",
  cidade: "São Paulo",
  uf: "SP",
  cep: "03319-000",
  telefone: "(11) 2227-7480",
  email: "diretoria@dasoares.com.br",
  inscricao_municipal: "25188348",
  responsavel_tecnico: "Victor Martins Soares",
  crc: "",
  cidade_foro: "São Paulo",
  multa_pct: "2",
  juros_mes_pct: "1",
  nome_cobranca: "Serviços contábeis",
  dia_vencimento_padrao: "20",
  indicacao_pct: "50",
  notificar_em: "",
};

describe("escritorioSchema", () => {
  it("aceita dados válidos e normaliza CNPJ/CEP para dígitos", () => {
    const r = escritorioSchema.parse(base);
    expect(r.cnpj).toBe("01496613000124");
    expect(r.cep).toBe("03319000");
    expect(r.multa_pct).toBe(2);
    expect(r.dia_vencimento_padrao).toBe(20);
  });
  it("rejeita CNPJ inválido", () => {
    expect(escritorioSchema.safeParse({ ...base, cnpj: "11.111.111/1111-11" }).success).toBe(false);
  });
  it("UF deve ter 2 letras", () => {
    expect(escritorioSchema.safeParse({ ...base, uf: "SPP" }).success).toBe(false);
    expect(escritorioSchema.safeParse({ ...base, uf: "S1" }).success).toBe(false);
    expect(escritorioSchema.parse({ ...base, uf: "sp" }).uf).toBe("SP");
  });
  it("CEP deve ter 8 dígitos", () => {
    expect(escritorioSchema.safeParse({ ...base, cep: "0331900" }).success).toBe(false);
  });
  it("rejeita percentual negativo e indicação acima de 100", () => {
    expect(escritorioSchema.safeParse({ ...base, multa_pct: "-1" }).success).toBe(false);
    expect(escritorioSchema.safeParse({ ...base, juros_mes_pct: "-0,5" }).success).toBe(false);
    expect(escritorioSchema.safeParse({ ...base, indicacao_pct: "101" }).success).toBe(false);
  });
  it("aceita percentual com vírgula", () => {
    expect(escritorioSchema.parse({ ...base, multa_pct: "2,5" }).multa_pct).toBe(2.5);
  });
  it("dia de vencimento entre 1 e 31", () => {
    expect(escritorioSchema.safeParse({ ...base, dia_vencimento_padrao: "0" }).success).toBe(false);
    expect(escritorioSchema.safeParse({ ...base, dia_vencimento_padrao: "32" }).success).toBe(false);
  });
});

describe("servicoExtraSchema", () => {
  it('converte "R$ 50,00" em 5000 centavos', () => {
    expect(servicoExtraSchema.parse({ nome: "Recálculo de guia", valor: "R$ 50,00" }).valor).toBe(5000);
  });
  it("rejeita nome vazio e valor negativo", () => {
    expect(servicoExtraSchema.safeParse({ nome: " ", valor: "R$ 50,00" }).success).toBe(false);
    expect(servicoExtraSchema.safeParse({ nome: "X", valor: "-R$ 5,00" }).success).toBe(false);
  });
});

describe("carteiraSchema", () => {
  it("aceita saídas conhecidas e rejeita outras", () => {
    expect(carteiraSchema.safeParse({ nome: "Cora", saida: "csv_cora" }).success).toBe(true);
    expect(carteiraSchema.safeParse({ nome: "Cora", saida: "x" }).success).toBe(false);
  });
});
