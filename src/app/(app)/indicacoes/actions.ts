"use server";

import { revalidatePath } from "next/cache";

import { baixarIndicacao, ErroIndicacao, registrarIndicacao } from "@/db/indicacoes";
import { formatarBRL } from "@/domain/dinheiro";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";

export type Resultado = { ok?: boolean; erro?: string; mensagem?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("clientes.editar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para registrar indicações."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

export async function baixar(indicacaoId: string, motivo: string): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado.replace("registrar", "baixar") };
  if (!UUID.test(indicacaoId)) return { erro: "Indicação inválida." };
  const m = motivo.trim();
  if (!m) return { erro: "Informe o motivo." };

  try {
    await baixarIndicacao(indicacaoId, m);
  } catch (e) {
    if (e instanceof ErroIndicacao) return { erro: e.message };
    console.error("[indicacoes] baixar:", e);
    return { erro: "Não foi possível concluir a operação. Tente novamente." };
  }

  try {
    await registrarAuditoria("indicacao.baixar", "indicacoes", indicacaoId, { motivo: m });
  } catch (e) {
    console.error("[indicacoes] auditoria:", e);
  }

  revalidatePath("/indicacoes");
  revalidatePath("/clientes", "layout");
  revalidatePath("/");
  return { ok: true, mensagem: "Indicação baixada." };
}

export async function registrar(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const indicadorId = String(dados.get("indicador_id") ?? "");
  const indicadoId = String(dados.get("indicado_id") ?? "");
  if (!UUID.test(indicadorId)) return { erro: "Selecione o cliente que indicou." };
  if (!UUID.test(indicadoId)) return { erro: "Selecione o cliente indicado." };
  if (indicadorId === indicadoId) return { erro: "Um cliente não pode indicar a si mesmo." };

  let r;
  try {
    r = await registrarIndicacao(indicadorId, indicadoId);
  } catch (e) {
    if (e instanceof ErroIndicacao) return { erro: e.message };
    console.error("[indicacoes] registrar:", e);
    return { erro: "Não foi possível concluir a operação. Tente novamente." };
  }

  // Auditoria depois do commit da RPC: uma falha aqui não desfaz a indicação, só vai para o log.
  try {
    await registrarAuditoria("indicacao.registrar", "indicacoes", r.indicacaoId, {
      indicador_id: indicadorId, indicado_id: indicadoId, gerado: r.gerado, liberado: r.liberado,
    });
  } catch (e) {
    console.error("[indicacoes] auditoria:", e);
  }

  revalidatePath("/indicacoes");
  revalidatePath(`/clientes/${indicadorId}`);
  revalidatePath(`/clientes/${indicadoId}`);
  const partes = [`Indicação registrada: crédito de ${formatarBRL(r.gerado)} para o indicador.`];
  partes.push(
    r.liberado > 0
      ? "A primeira cobrança do indicado já está paga: crédito liberado."
      : "O crédito será liberado quando a primeira cobrança do indicado for paga.",
  );
  return { ok: true, mensagem: partes.join(" ") };
}
