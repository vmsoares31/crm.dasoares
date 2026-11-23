"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";

import { obterCliente } from "@/db/clientes";
import { obterContrato } from "@/db/contratos";
import { obterEscritorio } from "@/db/escritorio";
import { pendenciasCadastro, ROTULOS_PENDENCIA } from "@/domain/completude";
import { camposContrato } from "@/domain/contrato-campos";
import { hojeSP } from "@/domain/datas";
import type { ParcelaAdicional } from "@/domain/tipos";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { ModeloContratoInvalidoError, renderizarContrato } from "@/lib/contrato-docx";
import { SofficeIndisponivelError, converterParaPdf } from "@/lib/pdf";
import { createServerClient } from "@/lib/supabase/server";

export type ResultadoGeracao = { ok?: boolean; aviso?: string; erro?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MODELO_PADRAO = path.join(process.cwd(), "templates", "contrato-padrao.docx");

function falha(contexto: string, detalhe: string): string {
  console.error(`[contratos/gerar] ${contexto}: ${detalhe}`);
  return "Não foi possível gerar o contrato. Tente novamente.";
}

/** Gera o contrato (.docx e, se houver LibreOffice, .pdf), salva no Storage e registra a versão. */
export async function gerarContrato(contratoId: string): Promise<ResultadoGeracao> {
  try {
    await exigirPermissao("contratos.editar");
  } catch (e) {
    return {
      erro: e instanceof SemPermissaoError
        ? "Você não tem permissão para gerar contratos."
        : "Não foi possível verificar suas permissões. Tente novamente.",
    };
  }
  if (!UUID.test(contratoId)) return { erro: "Contrato inválido." };

  const k = await obterContrato(contratoId);
  if (!k) return { erro: "Contrato não encontrado." };
  if (k.legado) return { erro: "Contrato anterior (sem documento no CRM): não gera documento." };
  if (k.situacao !== "fechado") return { erro: "Só é possível gerar o documento de contrato fechado." };
  if (k.cliente.situacao !== "ativo") return { erro: "O cliente precisa estar ativo para gerar o contrato." };

  const cliente = await obterCliente(k.cliente.id);
  if (!cliente || cliente.contrato?.id !== k.id) return { erro: "Cliente do contrato não encontrado." };
  const pendencias = pendenciasCadastro(cliente);
  if (pendencias.length > 0) {
    return { erro: `Resolva as pendências do cadastro: ${pendencias.map((p) => ROTULOS_PENDENCIA[p]).join(", ")}.` };
  }

  const supabase = await createServerClient();
  const escritorio = await obterEscritorio();

  let modelo: Buffer;
  if (escritorio.modelo_contrato_path) {
    const { data, error } = await supabase.storage.from("contratos").download(escritorio.modelo_contrato_path);
    if (error || !data) return { erro: falha("baixar modelo", error?.message ?? "vazio") };
    modelo = Buffer.from(await data.arrayBuffer());
  } else {
    modelo = await readFile(MODELO_PADRAO);
  }

  const parcelas: ParcelaAdicional[] = k.parcelas.map((p) => ({
    mes: p.mes, valor: p.valor, forma: p.forma as ParcelaAdicional["forma"], dia: p.dia,
  }));

  let docx: Buffer;
  try {
    docx = renderizarContrato(modelo, camposContrato(escritorio, cliente, k, parcelas, hojeSP()));
  } catch (e) {
    if (e instanceof ModeloContratoInvalidoError) return { erro: `${e.message}. Revise o modelo em Escritório.` };
    if (e instanceof Error) return { erro: `${e.message}.` };
    return { erro: falha("renderizar", String(e)) };
  }

  let pdf: Buffer | null = null;
  let aviso: string | undefined;
  try {
    pdf = await converterParaPdf(docx);
  } catch (e) {
    if (e instanceof SofficeIndisponivelError) {
      aviso = "PDF indisponível neste ambiente: somente o .docx foi gerado.";
    } else {
      console.error(`[contratos/gerar] pdf: ${e instanceof Error ? e.message : String(e)}`);
      aviso = "Não foi possível gerar o PDF: somente o .docx foi gerado.";
    }
  }

  const base = `${cliente.id}/${Date.now()}`;
  const docxPath = `${base}.docx`;
  const pdfPath = pdf ? `${base}.pdf` : null;
  const enviados: string[] = [];

  const up1 = await supabase.storage.from("contratos").upload(docxPath, docx, { contentType: MIME_DOCX, upsert: false });
  if (up1.error) return { erro: falha("upload docx", up1.error.message) };
  enviados.push(docxPath);
  if (pdf && pdfPath) {
    const up2 = await supabase.storage.from("contratos").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (up2.error) {
      await supabase.storage.from("contratos").remove(enviados);
      return { erro: falha("upload pdf", up2.error.message) };
    }
    enviados.push(pdfPath);
  }

  const { data: reg, error } = await supabase
    .from("contrato_documentos")
    .insert({ contrato_id: k.id, docx_path: docxPath, pdf_path: pdfPath })
    .select("id")
    .single();
  if (error || !reg) {
    await supabase.storage.from("contratos").remove(enviados);
    return { erro: falha("registrar documento", error?.message ?? "sem retorno") };
  }

  await registrarAuditoria("contrato.gerar_documento", "contratos", k.id, {
    documento_id: reg.id, docx_path: docxPath, pdf_path: pdfPath,
  });
  revalidatePath(`/contratos/${k.id}`);
  return { ok: true, aviso };
}
