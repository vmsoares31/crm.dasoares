import { describe, expect, it } from "vitest";

import { CORA_CABECALHO, camposCora, dataISOValida, gerarCsvCora, separarExportaveis, separarPorSaida, sugerirVencimento, type LinhaCora } from "@/domain/cora-csv";

const base: LinhaCora = {
  cobrancaId: "c1", nomePagador: "Renato Goncalves Anestesia Veterinaria Ltda", documento: "40342580000110",
  valor: 20058, vencimento: "2027-01-20", nomeCobranca: "Serviços contábeis", descricao: "Mensalidade R$ 200,58",
  tipo: "boleto_pix", email: "renatogmedvet@gmail.com", notificarEm: "", multaPct: 2, jurosPct: 1,
};
const HOJE = "2027-01-10";

describe("gerarCsvCora", () => {
  it("gera a linha padrão", () => {
    const { csv, erros } = gerarCsvCora([base], HOJE);
    expect(erros).toEqual([]);
    expect(csv.split("\r\n")[1]).toBe(
      "Renato Goncalves Anestesia Veterinaria Ltda;40342580000110;200,58;20/01/2027;Serviços contábeis;Mensalidade R$ 200,58;boleto_pix;renatogmedvet@gmail.com;;2%;1%;;",
    );
  });
  it("começa com BOM e cabeçalho exato", () => {
    const { csv } = gerarCsvCora([], HOJE);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).split("\r\n")[0]).toBe(CORA_CABECALHO.join(";"));
    expect(CORA_CABECALHO.join(";")).toBe("nome_do_pagador;cpf_cnpj;valor;vencimento;nome_cobranca;descricao;tipo_cobranca;email;notificar_em;multa;juros_mensal;desconto;desconto_valido_ate");
  });
  it("normaliza documento", () => {
    const { csv } = gerarCsvCora([{ ...base, documento: "40.342.580/0001-10" }], HOJE);
    expect(csv).toContain(";40342580000110;");
  });
  it("escapa ; e aspas", () => {
    const { csv } = gerarCsvCora([{ ...base, nomePagador: 'ACME; "Filial"' }], HOJE);
    expect(csv).toContain('"ACME; ""Filial"""');
  });
  it("valor abaixo do mínimo vira erro", () => {
    const r = gerarCsvCora([{ ...base, valor: 1999 }], HOJE);
    expect(r.erros).toEqual([{ cobrancaId: "c1", erro: "Valor abaixo de R$ 20,00" }]);
    expect(r.csv).not.toContain("19,99");
  });
  it("vencimento no passado vira erro", () => {
    expect(gerarCsvCora([{ ...base, vencimento: "2027-01-09" }], HOJE).erros[0].erro).toBe("Vencimento no passado");
    expect(gerarCsvCora([{ ...base, vencimento: HOJE }], HOJE).erros).toEqual([]);
  });
  it("cartão vira erro", () => {
    expect(gerarCsvCora([{ ...base, tipo: "cartao" }], HOJE).erros[0].erro).toBe("Cartão não vai ao arquivo do Cora");
  });
});

describe("sugerirVencimento", () => {
  it("soma 3 dias corridos", () => {
    expect(sugerirVencimento("2027-01-21")).toBe("2027-01-24");
    expect(sugerirVencimento("2027-12-30")).toBe("2028-01-02");
  });
});

describe("separarPorSaida", () => {
  const carteiras = [{ id: "a", saida: "csv_cora" as const }, { id: "b", saida: "lista_manual" as const }];
  it("separa por carteira e cartão", () => {
    const itens = [
      { n: 1, carteiraId: "a", tipo: "boleto" as const },
      { n: 2, carteiraId: "b", tipo: "boleto" as const },
      { n: 3, carteiraId: "a", tipo: "cartao" as const },
      { n: 4, carteiraId: null, tipo: "boleto" as const },
    ];
    const r = separarPorSaida(itens, carteiras);
    expect(r.cora.map((i) => i.n)).toEqual([1]);
    expect(r.manual.map((i) => i.n)).toEqual([2, 3, 4]);
  });
});

describe("separarExportaveis", () => {
  it("só prevista passa", () => {
    const r = separarExportaveis([{ s: 1, situacao: "prevista" }, { s: 2, situacao: "emitida" }, { s: 3, situacao: "paga" }]);
    expect(r.previstas.map((i) => i.s)).toEqual([1]);
    expect(r.ignoradas.map((i) => i.s)).toEqual([2, 3]);
  });
});

describe("dataISOValida", () => {
  it("valida calendário real", () => {
    expect(dataISOValida("2027-02-28")).toBe(true);
    expect(dataISOValida("2028-02-29")).toBe(true);
    expect(dataISOValida("2027-02-31")).toBe(false);
    expect(dataISOValida("2027-13-01")).toBe(false);
    expect(dataISOValida("27-01-01")).toBe(false);
  });
});

describe("camposCora", () => {
  it("tem uma coluna por cabeçalho", () => {
    expect(camposCora(base)).toHaveLength(CORA_CABECALHO.length);
  });
});

describe("separarPorSaida sem carteira", () => {
  it("carteira nula vai para a lista manual", () => {
    const r = separarPorSaida([{ carteiraId: null, tipo: "boleto" as const }], [{ id: "a", saida: "csv_cora" as const }]);
    expect(r.manual).toHaveLength(1);
    expect(r.cora).toHaveLength(0);
  });
});
