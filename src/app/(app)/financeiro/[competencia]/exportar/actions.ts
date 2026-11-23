"use server";

import { revalidatePath } from "next/cache";

import { aplicarVencimento, idsDoUltimoArquivo, marcarEmitidas } from "@/db/exportacao";
import { dataISOValida } from "@/domain/cora-csv";
import { hojeSP } from "@/domain/datas";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";

export type ResultadoExportacao = { ok?: boolean; erro?: string; mensagem?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("financeiro.operar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para operar o financeiro."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

function idsValidos(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string" || !UUID.test(i))) return null;
  return [...new Set(ids as string[])];
}

/** prevista → emitida para as selecionadas, ou para todas do último arquivo baixado ("ultimo"). */
export async function marcarComoEmitidas(competencia: string, ids: string[] | "ultimo"): Promise<ResultadoExportacao> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!COMPETENCIA.test(competencia)) return { erro: "Competência inválida." };

  try {
    let alvo: string[];
    if (ids === "ultimo") {
      alvo = await idsDoUltimoArquivo(competencia);
      if (alvo.length === 0) return { erro: "Nenhum arquivo foi baixado para esta competência ainda." };
    } else {
      const validos = idsValidos(ids);
      if (!validos || validos.length === 0) return { erro: "Selecione ao menos uma cobrança." };
      alvo = validos;
    }
    const marcadas = await marcarEmitidas(competencia, alvo);
    if (marcadas.length > 0) {
      await registrarAuditoria("cobrancas.marcar_emitidas", "competencia", null, {
        competencia, origem: ids === "ultimo" ? "ultimo_arquivo" : "selecao", cobranca_ids: marcadas,
      });
    }
    revalidatePath(`/financeiro/${competencia}`, "layout");
    const ignoradas = alvo.length - marcadas.length;
    return {
      ok: true,
      mensagem: `${marcadas.length} cobrança(s) marcada(s) como emitida(s)` +
        (ignoradas > 0 ? ` · ${ignoradas} ignorada(s) por não estarem mais previstas.` : "."),
    };
  } catch (e) {
    console.error("[financeiro] marcar emitidas:", e);
    return { erro: "Não foi possível concluir a operação. Tente novamente." };
  }
}

/** Troca o vencimento de cobranças previstas (cobranças já emitidas não mudam). */
export async function aplicarNovaData(competencia: string, ids: string[], data: string): Promise<ResultadoExportacao> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!COMPETENCIA.test(competencia)) return { erro: "Competência inválida." };
  const validos = idsValidos(ids);
  if (!validos || validos.length === 0) return { erro: "Selecione ao menos uma cobrança." };
  if (typeof data !== "string" || !dataISOValida(data)) return { erro: "Data inválida." };
  if (data < hojeSP()) return { erro: "A nova data não pode estar no passado." };

  try {
    const atualizadas = await aplicarVencimento(competencia, validos, data);
    if (atualizadas.length > 0) {
      await registrarAuditoria("cobrancas.alterar_vencimento", "competencia", null, {
        competencia, vencimento: data, cobranca_ids: atualizadas,
      });
    }
    revalidatePath(`/financeiro/${competencia}`, "layout");
    return { ok: true, mensagem: `Vencimento atualizado em ${atualizadas.length} cobrança(s).` };
  } catch (e) {
    console.error("[financeiro] aplicar nova data:", e);
    return { erro: "Não foi possível concluir a operação. Tente novamente." };
  }
}
