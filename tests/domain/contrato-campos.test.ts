import { describe, expect, it } from "vitest";

import { camposContrato } from "@/domain/contrato-campos";

import { clienteFicticio, escritorioFicticio, parcelasFicticias } from "../fixtures/contrato";

describe("camposContrato", () => {
  it("preenche os campos do contratante, da contratada e do contrato", () => {
    const c = clienteFicticio();
    const f = camposContrato(escritorioFicticio, c, c.contrato!, parcelasFicticias, "2026-11-23");
    expect(f.contratante_razao).toBe("EMPRESA FICTÍCIA LTDA");
    expect(f.contratante_cnpj).toBe("11.222.333/0001-81");
    expect(f.contratante_endereco).toBe("Av. Teste, 50");
    expect(f.contratante_cep).toBe("13000-000");
    expect(f.socio_admin_nome).toBe("Maria Fictícia");
    expect(f.socio_admin_cpf).toBe("529.982.247-25");
    expect(f.contratada_cnpj).toBe("11.444.777/0001-61");
    expect(f.contratada_endereco).toBe("Rua Exemplo, 100, Sala 2");
    expect(f.regime).toBe("Lucro Presumido");
    expect(f.honorario).toBe("R$ 350,00");
    expect(f.honorario_extenso).toBe("trezentos e cinquenta reais");
    expect(f.dia_vencimento).toBe("10");
    expect(f.data_inicio).toBe("01/01/2027");
    expect(f.cidade_foro).toBe("São Paulo");
    expect(f.data_contrato_extenso).toBe("23 de novembro de 2026");
    expect(f.tem_parcela_adicional).toBe(true);
    expect(f.texto_parcela_adicional).toContain("no mês de dezembro de cada ano");
  });

  it("regime simples_nacional vira 'Simples Nacional'", () => {
    const c = clienteFicticio({ regime: "simples_nacional" });
    expect(camposContrato(escritorioFicticio, c, c.contrato!, [], "2026-11-23").regime).toBe("Simples Nacional");
  });

  it("honorário 22000 por extenso", () => {
    const c = clienteFicticio();
    const k = { ...c.contrato!, honorario: 22000 };
    expect(camposContrato(escritorioFicticio, c, k, [], "2026-11-23").honorario_extenso).toBe("duzentos e vinte reais");
  });

  it("sem parcelas: cláusula 4.7 omitida", () => {
    const c = clienteFicticio();
    const f = camposContrato(escritorioFicticio, c, c.contrato!, [], "2026-11-23");
    expect(f.tem_parcela_adicional).toBe(false);
    expect(f.texto_parcela_adicional).toBe("");
  });

  it("e-mail cai para o de cobrança quando o cliente não tem", () => {
    const c = clienteFicticio({ email: null });
    const k = { ...c.contrato!, email_cobranca: "fin@ficticia.com.br" };
    expect(camposContrato(escritorioFicticio, c, k, [], "2026-11-23").contratante_email).toBe("fin@ficticia.com.br");
  });

  it("sem sócio administrador lança erro", () => {
    const c = clienteFicticio({ socios: [] });
    expect(() => camposContrato(escritorioFicticio, c, c.contrato!, [], "2026-11-23")).toThrow("Cliente sem sócio administrador");
  });

  it("dados obrigatórios do contrato ausentes lançam erro", () => {
    const c = clienteFicticio();
    expect(() => camposContrato(escritorioFicticio, c, { ...c.contrato!, honorario: null }, [], "2026-11-23")).toThrow("Contrato sem honorário");
    expect(() => camposContrato(escritorioFicticio, c, { ...c.contrato!, data_inicio: null }, [], "2026-11-23")).toThrow("Contrato sem data de início");
    expect(() => camposContrato(escritorioFicticio, clienteFicticio({ regime: null }), c.contrato!, [], "2026-11-23")).toThrow("Cliente sem regime tributário");
  });

  it("rótulo do documento do contratante: CNPJ (14 dígitos) ou CPF (11 dígitos)", () => {
    const pj = clienteFicticio();
    expect(camposContrato(escritorioFicticio, pj, pj.contrato!, [], "2026-11-23").rotulo_documento).toBe("CNPJ");
    const pf = clienteFicticio({ documento: "52998224725" });
    const f = camposContrato(escritorioFicticio, pf, pf.contrato!, [], "2026-11-23");
    expect(f.rotulo_documento).toBe("CPF");
    expect(f.contratante_cnpj).toBe("529.982.247-25");
    const formatado = clienteFicticio({ documento: "529.982.247-25" });
    expect(camposContrato(escritorioFicticio, formatado, formatado.contrato!, [], "2026-11-23").rotulo_documento).toBe("CPF");
  });

  it("cadastro do escritório incompleto lança erro listando os campos", () => {
    const c = clienteFicticio();
    const gerar = (e: Partial<typeof escritorioFicticio>) =>
      () => camposContrato({ ...escritorioFicticio, ...e }, c, c.contrato!, [], "2026-11-23");
    expect(gerar({ razao_social: " " })).toThrow("Cadastro do escritório incompleto: razão social");
    expect(gerar({ cnpj: "" })).toThrow("Cadastro do escritório incompleto: CNPJ");
    expect(gerar({ logradouro: "", numero: "", complemento: "" })).toThrow("Cadastro do escritório incompleto: endereço");
    expect(gerar({ uf: "" })).toThrow("Cadastro do escritório incompleto: cidade/UF");
    expect(gerar({ cidade: "" })).toThrow("Cadastro do escritório incompleto: cidade/UF");
    expect(gerar({ responsavel_tecnico: "" })).toThrow("Cadastro do escritório incompleto: responsável técnico");
    expect(gerar({ crc: "  " })).toThrow("Cadastro do escritório incompleto: CRC");
    expect(gerar({ razao_social: "", crc: "" })).toThrow("Cadastro do escritório incompleto: razão social, CRC");
    expect(gerar({ bairro: "", cep: "", cidade_foro: "" })).not.toThrow();
  });
});
