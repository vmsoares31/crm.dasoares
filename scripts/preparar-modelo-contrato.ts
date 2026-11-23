/* Uso: npx tsx scripts/preparar-modelo-contrato.ts [origem.docx] [destino.docx]
 * Lê o contrato-base (padrão: ../Contrato_ANDREWS_BORGES.docx), troca os dados fixos
 * da PICONT e do cliente por tags do docxtemplater e grava templates/contrato-padrao.docx.
 * Cláusula 6 e Anexos ficam intocados (o script confere). */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import PizZip from "pizzip";

const origem = path.resolve(process.argv[2] ?? "../Contrato_ANDREWS_BORGES.docx");
const destino = path.resolve(process.argv[3] ?? "templates/contrato-padrao.docx");

const decodificar = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const codificar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const RE_PARAGRAFO = /<w:p[ >][\s\S]*?<\/w:p>/g;
const RE_RUN = /<w:r(?: [^>]*)?>[\s\S]*?<\/w:r>/g;
const RE_T = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;

function textoDe(xml: string): string {
  return [...xml.matchAll(RE_T)].map((m) => decodificar(m[1])).join("");
}

function falhar(msg: string): never {
  throw new Error(`preparar-modelo: ${msg}`);
}

/** Troca `antigo` por `novo` dentro do parágrafo, fundindo só os runs cobertos (mantém a formatação do 1º). */
function trocarNoParagrafo(p: string, antigo: string, novo: string): string {
  const runs = [...p.matchAll(RE_RUN)].map((m) => ({ xml: m[0], inicio: m.index!, texto: textoDe(m[0]) }));
  let pos = 0;
  const offs = runs.map((r) => {
    const o = pos;
    pos += r.texto.length;
    return o;
  });
  const total = runs.map((r) => r.texto).join("");
  const ini = total.indexOf(antigo);
  if (ini < 0) falhar(`trecho não encontrado: "${antigo}" em "${total.slice(0, 80)}…"`);
  if (total.indexOf(antigo, ini + 1) >= 0) falhar(`trecho ambíguo: "${antigo}"`);
  const fim = ini + antigo.length;
  const cobertos = runs.map((_, i) => i).filter((i) => offs[i] < fim && offs[i] + runs[i].texto.length > ini);
  for (const i of cobertos) {
    if ([...runs[i].xml.matchAll(RE_T)].length !== 1 || /<w:(tab|br)\b/.test(runs[i].xml)) {
      falhar(`run complexo no trecho "${antigo}"`);
    }
  }
  const primeiro = cobertos[0];
  const ultimo = cobertos[cobertos.length - 1];
  const antes = runs[primeiro].texto.slice(0, ini - offs[primeiro]);
  const depois = runs[ultimo].texto.slice(fim - offs[ultimo]);
  const novoRun = runs[primeiro].xml.replace(
    RE_T,
    `<w:t xml:space="preserve">${codificar(antes + novo + depois)}</w:t>`,
  );
  let saida = "";
  let cursor = 0;
  runs.forEach((r, i) => {
    saida += p.slice(cursor, r.inicio);
    if (i === primeiro) saida += novoRun;
    else if (!cobertos.includes(i)) saida += r.xml;
    cursor = r.inicio + r.xml.length;
  });
  return saida + p.slice(cursor);
}

const zip = new PizZip(readFileSync(origem));
const docXml = zip.file("word/document.xml")?.asText() ?? falhar("word/document.xml ausente");
const paragrafos = docXml.match(RE_PARAGRAFO) ?? falhar("sem parágrafos");
const textos = paragrafos.map(textoDe);
const novos = [...paragrafos];

// Trechos que precisam ficar idênticos: cláusula 6 e Anexos.
const idxCl6 = textos.findIndex((t) => t.startsWith("CLÁUSULA 6"));
const idxCl7 = textos.findIndex((t) => t.startsWith("CLÁUSULA 7"));
const idxAnexo1 = textos.findIndex((t) => t.startsWith("ANEXO 1"));
if (idxCl6 < 0 || idxCl7 < 0 || idxAnexo1 < 0) falhar("cláusula 6/7 ou Anexo 1 não encontrados");
const protegidos = new Set<number>();
for (let i = idxCl6; i < idxCl7; i++) protegidos.add(i);
for (let i = idxAnexo1; i < paragrafos.length; i++) protegidos.add(i);

function trocar(i: number, antigo: string, novo: string) {
  if (protegidos.has(i)) falhar(`tentativa de alterar trecho protegido (parágrafo ${i})`);
  novos[i] = trocarNoParagrafo(novos[i], antigo, novo);
}

// 1) Qualificação das partes: valores em parágrafos próprios, na ordem do documento.
const QUALIFICACAO: [string, string][] = [
  ["ANDREWS BORGES LTDA", "{contratante_razao}"],
  ["22.184.118/0001-50", "{contratante_cnpj}"],
  ["Rua Otília", "{contratante_endereco}"],
  ["Vila Esperança", "{contratante_bairro}"],
  ["São Paulo", "{contratante_cidade}"],
  ["SP", "{contratante_uf}"],
  ["03.649-000", "{contratante_cep}"],
  ["andrews.borges@gmail.com", "{contratante_email}"],
  ["11 91430-3449", "{contratante_telefone}"],
  ["Andrews Borges", "{socio_admin_nome}"],
  ["384.992.448-31", "{socio_admin_cpf}"],
  ["PICONT CONTABILIDADE LTDA", "{contratada_razao}"],
  ["37.781.049/0001-39", "{contratada_cnpj}"],
  ["Rua Cantagalo, 222 Andar 1 Sala 1", "{contratada_endereco}"],
  ["Vila Gomes Cardim", "{contratada_bairro}"],
  ["São Paulo", "{contratada_cidade}"],
  ["São Paulo", "{contratada_uf}"],
  ["03319-000", "{contratada_cep}"],
  ["Victor Martins Soares", "{responsavel_tecnico}"],
  ["1SP331183-O6", "{crc}"],
];
let cursor = 0;
for (const [valor, tag] of QUALIFICACAO) {
  const i = textos.findIndex((t, k) => k >= cursor && t.trim() === valor);
  if (i < 0) falhar(`qualificação: "${valor}" não encontrado`);
  trocar(i, textos[i], tag);
  cursor = i + 1;
}

function achar(prefixo: string): number {
  const achados = textos.map((t, i) => (t.trimStart().startsWith(prefixo) ? i : -1)).filter((i) => i >= 0);
  if (achados.length !== 1) falhar(`parágrafo "${prefixo}" encontrado ${achados.length} vezes`);
  return achados[0];
}

// 2) Cláusula 3.4: regime.
trocar(achar("3.4 -"), "Simples Nacional", "{regime}");

// 3) Cláusula 4: honorário, extenso e dia.
trocar(
  achar("Para a execução dos serviços"),
  "R$ 220,00 (duzentos e vinte reais), até o dia 20 do mês",
  "{honorario} ({honorario_extenso}), até o dia {dia_vencimento} do mês",
);

// 4) Cláusula 4.7: forma da parcela adicional.
const i47 = achar("4.7 –");
const t47 = textos[i47];
const ini47 = t47.indexOf("no mês de dezembro");
const fim47 = t47.indexOf("(duzentos e cinquenta reais)") + "(duzentos e cinquenta reais)".length;
if (ini47 < 0 || fim47 < ini47) falhar("trecho da cláusula 4.7 não encontrado");
trocar(i47, t47.slice(ini47, fim47), "{texto_parcela_adicional}");

// 4.7 e 4.7.1 só saem quando há parcela adicional: envolve-os numa seção condicional
// (parágrafos só com a tag são removidos pelo paragraphLoop do docxtemplater).
const i471 = achar("4.7.1 –");
const paragrafoTag = (tag: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:jc w:val="both"/></w:pPr><w:r><w:t>${tag}</w:t></w:r></w:p>`;
novos[i47] = paragrafoTag("{#tem_parcela_adicional}") + novos[i47];
novos[i471] = novos[i471] + paragrafoTag("{/tem_parcela_adicional}");

// 5) Cláusula 5: data de início.
trocar(achar("A vigência do presente contrato"), "01/08/2026", "{data_inicio}");

// 6) Cláusula 7 (foro) e data do contrato.
trocar(achar("Fica eleito o foro da comarca"), "comarca de São Paulo", "comarca de {cidade_foro}");
trocar(achar("São Paulo, 01 de Agosto de 2026."), "São Paulo, 01 de Agosto de 2026.", "{cidade_foro}, {data_contrato_extenso}.");

// 7) Assinaturas: nomes centralizados sob as linhas por tabulações (as mesmas da linha de assinatura).
const iLinha = textos.findIndex((t) => t.startsWith("______"));
const iAss1 = iLinha + 1;
const iAss2 = iLinha + 2;
if (
  iLinha < 0 ||
  !/Picont Contabilidade Ltda\s+Andrews Borges Ltda/.test(textos[iAss1]) ||
  !/Victor Martins Soares\s+Andrews Borges/.test(textos[iAss2])
) {
  falhar("bloco de assinaturas fora do esperado");
}
const tabs = paragrafos[iLinha].match(/<w:tabs>[\s\S]*?<\/w:tabs>/)?.[0] ?? falhar("tabulações da assinatura");
function assinatura(i: number, esquerda: string, direita: string): string {
  const p = paragrafos[i];
  const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "<w:pPr></w:pPr>")
    .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, "")
    .replace(/<w:jc [^>]*\/>/, "")
    .replace(/(<w:pStyle [^>]*\/>)?/, (m) => `${m}${tabs}`);
  const rPr = p.match(/<w:r>(<w:rPr>[\s\S]*?<\/w:rPr>)/)?.[1] ?? "";
  return `<w:p>${pPr}<w:r>${rPr}<w:tab/><w:t>${esquerda}</w:t><w:tab/><w:t>${direita}</w:t></w:r></w:p>`;
}
novos[iAss1] = assinatura(iAss1, "{contratada_razao}", "{contratante_razao}");
novos[iAss2] = assinatura(iAss2, "{responsavel_tecnico}", "{socio_admin_nome}");

// Reconstrói o document.xml.
let k = 0;
const novoDoc = docXml.replace(RE_PARAGRAFO, () => novos[k++]);
zip.file("word/document.xml", novoDoc);

// Cabeçalho e rodapé: o original é o papel timbrado da PICONT (logo e faixas). Troca por um
// cabeçalho simples com os dados da CONTRATADA e rodapé vazio; o administrador pode subir
// um modelo com o timbrado próprio (Escritório → Modelo de contrato).
const ns = (docXml.match(/<w:document([^>]*)>/) ?? falhar("raiz do documento"))[1];
const rFonte = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`;
const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr${ns}><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="end"/></w:pPr><w:r><w:rPr>${rFonte}<w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>{contratada_razao}</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="end"/></w:pPr><w:r><w:rPr>${rFonte}<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">{contratada_endereco} – {contratada_bairro} – {contratada_cidade}/{contratada_uf} – CEP {contratada_cep}</w:t></w:r></w:p></w:hdr>`;
const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr${ns}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr></w:p></w:ftr>`;
const relsVazio = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
for (const nome of Object.keys(zip.files)) {
  if (/^word\/header\d+\.xml$/.test(nome)) zip.file(nome, header);
  if (/^word\/footer\d+\.xml$/.test(nome)) zip.file(nome, footer);
  if (/^word\/_rels\/(header|footer)\d+\.xml\.rels$/.test(nome)) zip.file(nome, relsVazio);
}
const docRels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
for (const nome of Object.keys(zip.files)) {
  if (nome.startsWith("word/media/") && !docRels.includes(nome.slice("word/".length))) zip.remove(nome);
}

// Conferências finais.
const final = textoDe(novoDoc);
for (const proibido of ["PICONT", "Picont", "ANDREWS", "Andrews", "22.184.118", "37.781.049", "Cantagalo", "Victor Martins"]) {
  if (final.includes(proibido)) falhar(`texto fixo remanescente: ${proibido}`);
}
const paragrafosFinais = novoDoc.match(RE_PARAGRAFO)!;
const inicioCl6Final = paragrafosFinais.findIndex((p) => textoDe(p).startsWith("CLÁUSULA 6"));
for (let i = idxCl6; i < idxCl7; i++) {
  if (paragrafosFinais[inicioCl6Final + (i - idxCl6)] !== paragrafos[i]) falhar("cláusula 6 foi alterada");
}
if (!novoDoc.endsWith(docXml.slice(docXml.indexOf(paragrafos[idxAnexo1])))) falhar("Anexos foram alterados");

writeFileSync(destino, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Modelo gravado em ${destino}`);
