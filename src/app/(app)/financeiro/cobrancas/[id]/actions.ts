"use server";

import { revalidatePath } from "next/cache";

import { ErroCobranca, cancelarCobranca, dispensarSaldo, registrarBaixa } from "@/db/cobrancas";
import { validarBaixa } from "@/domain/baixa";
import { hojeSP } from "@/domain/datas";
import { formatarBRL, parseBRL } from "@/domain/dinheiro";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";

export type ResultadoAcaoCobranca = { ok?: boolean; erro?: string; mensagem?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function falha(contexto: string, e: unknown): ResultadoAcaoCobranca {
  if (e instanceof ErroCobranca) return { erro: e.message };
  console.error(`[financeiro] ${contexto}:`, e);
  return { erro: "Não foi possível concluir a operação. Tente novamente." };
}

/** Auditoria depois do commit da RPC: uma falha aqui não desfaz a operação, só é registrada no log. */
async function auditar(acao: string, id: string, dados: object): Promise<void> {
  try {
    await registrarAuditoria(acao, "cobrancas", id, dados);
  } catch (e) {
    console.error(`[financeiro] auditoria ${acao}:`, e);
  }
}

function revalidar(id: string) {
  revalidatePath(`/financeiro/cobrancas/${id}`);
  revalidatePath("/financeiro", "layout");
  revalidatePath("/extras");
}

export async function darBaixa(id: string, data: string, valorTexto: string): Promise<ResultadoAcaoCobranca> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id) || typeof data !== "string" || typeof valorTexto !== "string") return { erro: "Dados inválidos." };
  const valor = parseBRL(valorTexto);
  const invalido = validarBaixa(data, valor, hojeSP());
  if (invalido) return { erro: invalido };

  let r;
  try {
    r = await registrarBaixa(id, data, valor);
  } catch (e) {
    return falha("baixa", e);
  }
  await auditar("cobranca.baixa", id, {
    data, valor, situacao: r.situacao, valor_recebido: r.valorRecebido,
    credito_liberado: r.creditoLiberado, indicador_id: r.indicadorId,
  });
  revalidar(id);
  if (r.indicadorId) revalidatePath(`/clientes/${r.indicadorId}`);
  const partes = [r.situacao === "paga" ? "Baixa registrada: cobrança paga." : "Baixa registrada: cobrança paga parcialmente."];
  if (r.creditoLiberado > 0) partes.push(`Crédito de indicação de ${formatarBRL(r.creditoLiberado)} liberado para o indicador.`);
  return { ok: true, mensagem: partes.join(" ") };
}

export async function cancelar(id: string, motivo: string): Promise<ResultadoAcaoCobranca> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id)) return { erro: "Dados inválidos." };
  const m = typeof motivo === "string" ? motivo.trim() : "";
  if (!m) return { erro: "Informe o motivo." };

  let r;
  try {
    r = await cancelarCobranca(id, m);
  } catch (e) {
    return falha("cancelar", e);
  }
  await auditar("cobranca.cancelar", id, { motivo: m, credito_estornado: r.estornado });
  revalidar(id);
  return {
    ok: true,
    mensagem: r.estornado > 0
      ? `Cobrança cancelada. ${formatarBRL(r.estornado)} de crédito de indicação voltaram ao saldo do cliente.`
      : "Cobrança cancelada.",
  };
}

export async function dispensar(id: string, motivo: string): Promise<ResultadoAcaoCobranca> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id)) return { erro: "Dados inválidos." };
  const m = typeof motivo === "string" ? motivo.trim() : "";
  if (!m) return { erro: "Informe o motivo." };

  try {
    await dispensarSaldo(id, m);
  } catch (e) {
    return falha("dispensar saldo", e);
  }
  await auditar("cobranca.dispensar_saldo", id, { motivo: m });
  revalidar(id);
  return { ok: true, mensagem: "Saldo dispensado." };
}
