"use server";

import { revalidatePath } from "next/cache";

import {
  ErroCobranca, abrirCompetencia, cancelarCobrancaPrevista, editarCobranca, regerarCompetencia,
  type ResultadoCompetencia,
} from "@/db/cobrancas";
import { contarExportadasPrevistas } from "@/db/exportacao";
import { parseBRL } from "@/domain/dinheiro";
import type { ItemCobranca, TipoItem } from "@/domain/tipos";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";

export type ResultadoAcao = {
  ok?: boolean; erro?: string; mensagem?: string; naoGerados?: ResultadoCompetencia["naoGerados"];
  /** Regerar recusado: cobranças do último arquivo exportado ainda previstas (pede confirmação). */
  exportadasPendentes?: number;
};
export type ItemEditado = { tipo: string; descricao: string; valor: string; refId?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const TIPOS: readonly string[] = ["mensalidade", "extra", "parcela_adicional", "desconto_indicacao"];

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

function falha(contexto: string, e: unknown): ResultadoAcao {
  if (e instanceof ErroCobranca) return { erro: e.message };
  console.error(`[financeiro] ${contexto}:`, e);
  return { erro: "Não foi possível concluir a operação. Tente novamente." };
}

function resumo(r: ResultadoCompetencia, regerar: boolean): string {
  const partes = [`${r.cobrancas.length} cobrança(s) gerada(s)`];
  if (regerar) partes.push(`${r.removidas} prevista(s) refeita(s)`);
  if (r.mantidas > 0) partes.push(`${r.mantidas} mantida(s) sem alteração`);
  if (r.naoGerados.length > 0) partes.push(`${r.naoGerados.length} cliente(s) não gerado(s)`);
  return `${partes.join(" · ")}.`;
}

async function executar(competencia: string, regerar: boolean, confirmarDescarteExportacao = false): Promise<ResultadoAcao> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!COMPETENCIA.test(competencia)) return { erro: "Competência inválida." };

  // Regerar apaga previstas; se alguma está no último arquivo exportado e ainda não foi marcada
  // como emitida, o boleto pode já existir no banco — só segue com confirmação explícita.
  if (regerar && confirmarDescarteExportacao !== true) {
    let pendentes: number;
    try {
      pendentes = await contarExportadasPrevistas(competencia);
    } catch (e) {
      return falha("verificar exportação", e);
    }
    if (pendentes > 0) return { exportadasPendentes: pendentes };
  }

  let r: ResultadoCompetencia;
  try {
    r = regerar ? await regerarCompetencia(competencia) : await abrirCompetencia(competencia);
  } catch (e) {
    return falha(regerar ? "regerar" : "abrir", e);
  }
  await registrarAuditoria(regerar ? "competencia.regerar" : "competencia.abrir", "cobrancas", null, {
    competencia,
    geradas: r.cobrancas.length,
    removidas: r.removidas,
    mantidas: r.mantidas,
    nao_gerados: r.naoGerados.map((n) => ({ cliente_id: n.clienteId, motivo: n.motivo })),
    ...(regerar && confirmarDescarteExportacao ? { descarte_exportacao_confirmado: true } : {}),
  });
  revalidatePath(`/financeiro/${competencia}`);
  revalidatePath("/extras");
  return { ok: true, mensagem: resumo(r, regerar), naoGerados: r.naoGerados };
}

export async function abrirMes(competencia: string): Promise<ResultadoAcao> {
  return executar(competencia, false);
}

export async function regerarPrevistas(
  competencia: string,
  opcoes: { confirmarDescarteExportacao?: boolean } = {},
): Promise<ResultadoAcao> {
  return executar(competencia, true, opcoes?.confirmarDescarteExportacao === true);
}

export async function salvarItens(competencia: string, id: string, itens: ItemEditado[]): Promise<ResultadoAcao> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id) || !COMPETENCIA.test(competencia) || !Array.isArray(itens)) return { erro: "Dados inválidos." };

  const convertidos: ItemCobranca[] = [];
  for (const i of itens) {
    if (!i || !TIPOS.includes(i.tipo) || typeof i.descricao !== "string" || typeof i.valor !== "string") {
      return { erro: "Item inválido." };
    }
    if (i.refId && !UUID.test(i.refId)) return { erro: "Item inválido." };
    convertidos.push({
      tipo: i.tipo as TipoItem, descricao: i.descricao, valor: parseBRL(i.valor), ...(i.refId ? { refId: i.refId } : {}),
    });
  }

  try {
    await editarCobranca(id, convertidos);
  } catch (e) {
    return falha("editar", e);
  }
  await registrarAuditoria("cobranca.editar_itens", "cobrancas", id, {
    itens: convertidos.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, ref_id: i.refId ?? null })),
  });
  revalidatePath(`/financeiro/${competencia}`);
  revalidatePath("/extras");
  return { ok: true, mensagem: "Itens salvos." };
}

export async function excluirDoMes(competencia: string, id: string, motivo: string): Promise<ResultadoAcao> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id) || !COMPETENCIA.test(competencia)) return { erro: "Dados inválidos." };
  const m = typeof motivo === "string" ? motivo.trim() : "";
  if (!m) return { erro: "Informe o motivo." };

  try {
    await cancelarCobrancaPrevista(id, m);
  } catch (e) {
    return falha("excluir do mês", e);
  }
  await registrarAuditoria("cobranca.excluir_do_mes", "cobrancas", id, { competencia, motivo: m });
  revalidatePath(`/financeiro/${competencia}`);
  revalidatePath("/extras");
  return { ok: true, mensagem: "Cliente excluído do mês." };
}
