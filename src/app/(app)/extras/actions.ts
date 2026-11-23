"use server";

import { revalidatePath } from "next/cache";

import { parseBRL } from "@/domain/dinheiro";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function falha(contexto: string, detalhe: string): string {
  console.error(`[extras] ${contexto}: ${detalhe}`);
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("financeiro.operar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para lançar extras."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

export async function lancarExtra(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const clienteId = String(dados.get("cliente_id") ?? "");
  const servicoId = String(dados.get("servico_id") ?? "");
  const descricao = String(dados.get("descricao") ?? "").trim();
  const valor = parseBRL(String(dados.get("valor") ?? ""));
  const data = String(dados.get("data") ?? "");
  const competencia = String(dados.get("competencia") ?? "");
  const observacao = String(dados.get("observacao") ?? "").trim();

  if (!UUID.test(clienteId)) return { erro: "Selecione o cliente." };
  if (servicoId && !UUID.test(servicoId)) return { erro: "Serviço inválido." };
  if (!descricao) return { erro: "Informe a descrição do serviço." };
  if (!(valor > 0)) return { erro: "Informe um valor maior que zero." };
  if (!DATA.test(data) || Number.isNaN(Date.parse(data))) return { erro: "Informe a data do serviço." };
  if (!COMPETENCIA.test(competencia)) return { erro: "Competência inválida. Use o formato AAAA-MM." };

  const supabase = await createServerClient();
  const { data: criado, error } = await supabase
    .from("lancamentos_extras")
    .insert({
      cliente_id: clienteId,
      servico_id: servicoId || null,
      descricao,
      valor,
      data,
      competencia,
      observacao: observacao || null,
    })
    .select("id")
    .single();
  if (error || !criado) return { erro: falha("lançar", error?.message ?? "sem retorno") };

  await registrarAuditoria("extra.lancar", "lancamentos_extras", criado.id, {
    cliente_id: clienteId, descricao, valor, competencia,
  });
  revalidatePath("/extras");
  return { ok: true };
}

/** Cancela um extra ainda pendente (já incluído em cobrança não pode ser cancelado aqui). */
export async function cancelarExtra(id: string): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  if (!UUID.test(id)) return { erro: "Lançamento inválido." };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("lancamentos_extras")
    .update({ situacao: "cancelado" })
    .eq("id", id)
    .eq("situacao", "pendente")
    .select("id");
  if (error) return { erro: falha("cancelar", error.message) };
  if (!data || data.length === 0) return { erro: "Só é possível cancelar extras pendentes." };

  await registrarAuditoria("extra.cancelar", "lancamentos_extras", id);
  revalidatePath("/extras");
  return { ok: true };
}
