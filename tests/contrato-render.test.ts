import { readFileSync } from "node:fs";
import path from "node:path";

import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { camposContrato } from "@/domain/contrato-campos";
import { renderizarContrato } from "@/lib/contrato-docx";
import { converterParaPdf, sofficeDisponivel } from "@/lib/pdf";

import { clienteFicticio, escritorioFicticio, parcelasFicticias } from "./fixtures/contrato";

const MODELO = readFileSync(path.resolve(__dirname, "../templates/contrato-padrao.docx"));

function textoDoXml(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function renderizar(parcelas = parcelasFicticias) {
  const c = clienteFicticio();
  const campos = camposContrato(escritorioFicticio, c, c.contrato!, parcelas, "2026-11-23");
  const zip = new PizZip(renderizarContrato(MODELO, campos));
  return {
    doc: textoDoXml(zip.file("word/document.xml")!.asText()),
    header: textoDoXml(zip.file("word/header1.xml")!.asText()),
    footer: textoDoXml(zip.file("word/footer1.xml")!.asText()),
  };
}

const CLAUSULA_6 =
  "CLÁUSULA 6 – DA RESPONSABILIDADE DOS SÓCIOS\n\nOs sócios da Contratante, assinam o presente na condição de fiadores solidários e principais pagadores em relação a todas as obrigações contratuais decorrentes.";

describe("renderizarContrato (modelo padrão)", () => {
  it("preenche os campos e remove os dados fixos do contrato-base", () => {
    const { doc, header, footer } = renderizar();
    expect(doc).toContain("Lucro Presumido");
    expect(doc).toContain("R$ 350,00 (trezentos e cinquenta reais)");
    expect(doc).toContain("D. A. SOARES CONTABILIDADE LTDA.");
    expect(doc).toContain(CLAUSULA_6);
    expect(doc).toContain("11.222.333/0001-81");
    expect(doc).toContain("até o dia 10 do mês vigente");
    expect(doc).toContain("iniciando em 01/01/2027");
    expect(doc).toContain("São Paulo, 23 de novembro de 2026.");
    expect(doc).toContain(
      "4.7 – Além dos honorários mensais, a CONTRATANTE pagará à CONTRATADA, no mês de dezembro de cada ano, a ser pago até o dia 10 daquele mês, juntamente com os honorários mensais, uma parcela adicional, no valor inicial de R$ 350,00 (trezentos e cinquenta reais), a qual será reajustada",
    );
    expect(doc).toContain("\tD. A. SOARES CONTABILIDADE LTDA.\tEMPRESA FICTÍCIA LTDA");
    expect(doc).toContain("\tFulano de Tal\tMaria Fictícia");
    for (const proibido of ["PICONT", "Picont", "ANDREWS", "Andrews", "22.184.118", "37.781.049", "{", "}"]) {
      expect(doc).not.toContain(proibido);
      expect(header + footer).not.toContain(proibido);
    }
    expect(header).toContain("D. A. SOARES CONTABILIDADE LTDA.");
  });

  it("Anexo 1 continua lista única (cita o Simples Nacional entre os tributos)", () => {
    const { doc } = renderizar();
    expect(doc).toContain("I.P.I; Simples Nacional; ISS");
    expect(doc).toContain("Escrituração do livro Lalur quando se tratar de empresa com apuração do lucro real");
  });

  it("sem parcela adicional, omite as cláusulas 4.7 e 4.7.1", () => {
    const { doc } = renderizar([]);
    expect(doc).not.toContain("4.7 –");
    expect(doc).not.toContain("4.7.1");
    expect(doc).toContain("4.6 - Os serviços não contratados");
    expect(doc).toContain("CLÁUSULA 5");
  });

  it("modelo com tag desconhecida ou malformada lança erro claro", () => {
    const zip = new PizZip(MODELO);
    const xml = zip.file("word/document.xml")!.asText().replace("{regime}", "{regime");
    zip.file("word/document.xml", xml);
    const ruim = zip.generate({ type: "nodebuffer" });
    const c = clienteFicticio();
    expect(() => renderizarContrato(ruim, camposContrato(escritorioFicticio, c, c.contrato!, [], "2026-11-23"))).toThrow(
      /Modelo de contrato inválido/,
    );
  });
});

describe.skipIf(!sofficeDisponivel())("converterParaPdf", () => {
  it("gera um PDF a partir do contrato renderizado", async () => {
    const c = clienteFicticio();
    const docx = renderizarContrato(MODELO, camposContrato(escritorioFicticio, c, c.contrato!, parcelasFicticias, "2026-11-23"));
    const pdf = await converterParaPdf(docx);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 120_000);
});
