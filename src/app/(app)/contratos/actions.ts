"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { contratoVigenteDoCliente, obterContrato } from "@/db/contratos";
import { contratoSchema } from "@/domain/contrato-schema";
import { validarParcelas } from "@/domain/parcelas";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

const ROTULOS: Record<string, string> = {
  situacao: "Situação", honorario: "Honorário", dia_vencimento: "Dia de vencimento", data_inicio: "Data de início",
  tipo_cobranca: "Tipo de cobrança", email_cobranca: "E-mail de cobrança", parcela_adicional_total: "Parcela adicional",
  encerrado_em: "Data de encerramento", parcelas: "Parcelas",
};

function falha(contexto: string, detalhe: string): string {
  console.error(`[contratos] ${contexto}: ${detalhe}`);
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("contratos.editar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para editar contratos."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

/** Cria o contrato (em negociação) de um cliente sem contrato vigente e abre a tela dele. */
export async function criarContrato(clienteId: string): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const existente = await contratoVigenteDoCliente(clienteId);
  if (existente) redirect(`/contratos/${existente}`);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contratos").insert({ cliente_id: clienteId, situacao: "em_negociacao" }).select("id").single();
  if (error || !data) return { erro: falha("criar", error?.message ?? "sem retorno") };
  await registrarAuditoria("contrato.criar", "contratos", data.id, { cliente_id: clienteId });
  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/contratos/${data.id}`);
}

export async function salvarContrato(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const id = String(dados.get("id") ?? "");
  if (!id) return { erro: "Contrato não informado." };

  const r = contratoSchema.safeParse({
    situacao: dados.get("situacao") ?? "",
    honorario: dados.get("honorario") ?? "",
    dia_vencimento: dados.get("dia_vencimento") ?? "",
    data_inicio: dados.get("data_inicio") ?? "",
    carteira_id: dados.get("carteira_id") ?? "",
    tipo_cobranca: dados.get("tipo_cobranca") ?? "",
    email_cobranca: dados.get("email_cobranca") ?? "",
    parcela_adicional_total: dados.get("parcela_adicional_total") ?? "",
    legado: dados.get("legado") === "on",
    encerrado_em: dados.get("encerrado_em") ?? "",
    motivo: dados.get("motivo") ?? "",
    parcelas: dados.get("parcelas") ?? "",
  });
  if (!r.success) {
    return { erro: r.error.issues.map((i) => `${ROTULOS[String(i.path[0])] ?? String(i.path[0] ?? "")}: ${i.message}`).join(" · ") };
  }
  const { motivo, parcelas, ...campos } = r.data;

  const atual = await obterContrato(id);
  if (!atual) return { erro: "Contrato não encontrado." };
  if (atual.situacao === "encerrado") return { erro: "Contrato encerrado não pode ser alterado." };

  if (campos.situacao === "fechado" && atual.cliente.situacao !== "ativo") {
    return { erro: "Confirme o cadastro do cliente antes de fechar o contrato." };
  }
  const errosParcelas = validarParcelas(parcelas, campos.parcela_adicional_total);
  if (errosParcelas.length) return { erro: errosParcelas.join(" · ") };
  if (campos.situacao !== "encerrado") campos.encerrado_em = null;

  const supabase = await createServerClient();
  const { error: erroContrato } = await supabase.from("contratos").update(campos).eq("id", id);
  if (erroContrato) return { erro: falha("atualizar", erroContrato.message) };

  // Substitui as parcelas; em caso de falha na inserção, restaura as anteriores.
  const { error: erroDel } = await supabase.from("parcelas_adicionais").delete().eq("contrato_id", id);
  if (erroDel) return { erro: falha("limpar parcelas", erroDel.message) };
  if (parcelas.length) {
    const { error: erroIns } = await supabase
      .from("parcelas_adicionais")
      .insert(parcelas.map((p) => ({ contrato_id: id, mes: p.mes, valor: p.valor, forma: p.forma, dia: p.dia })));
    if (erroIns) {
      if (atual.parcelas.length) {
        await supabase.from("parcelas_adicionais").insert(
          atual.parcelas.map((p) => ({ contrato_id: id, mes: p.mes, valor: p.valor, forma: p.forma, dia: p.dia })),
        );
      }
      return { erro: falha("gravar parcelas", erroIns.message) };
    }
  }

  const historico: { contrato_id: string; campo: string; de: number | null; para: number | null; motivo: string | null }[] = [];
  if (atual.honorario !== campos.honorario) {
    historico.push({ contrato_id: id, campo: "honorario", de: atual.honorario, para: campos.honorario, motivo });
  }
  if (atual.parcela_adicional_total !== campos.parcela_adicional_total) {
    historico.push({
      contrato_id: id, campo: "parcela_adicional_total",
      de: atual.parcela_adicional_total, para: campos.parcela_adicional_total, motivo,
    });
  }
  if (historico.length) {
    const { error } = await supabase.from("historico_valores").insert(historico);
    if (error) return { erro: falha("histórico de valores", error.message) };
  }

  await registrarAuditoria("contrato.atualizar", "contratos", id, { ...campos, parcelas });
  revalidatePath(`/contratos/${id}`);
  revalidatePath("/contratos");
  revalidatePath(`/clientes/${atual.cliente_id}`);
  return { ok: true };
}
