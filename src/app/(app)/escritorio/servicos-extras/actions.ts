"use server";

import { revalidatePath } from "next/cache";

import { servicoExtraSchema } from "@/domain/escritorio-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

export async function salvarServicoExtra(_: Resultado, dados: FormData): Promise<Resultado> {
  try {
    await exigirPermissao("escritorio.editar");
  } catch {
    return { erro: "Você não tem permissão para editar serviços extras." };
  }
  const r = servicoExtraSchema.safeParse({ nome: dados.get("nome") ?? "", valor: dados.get("valor") ?? "" });
  if (!r.success) return { erro: r.error.issues.map((i) => i.message).join(" ") };
  const id = String(dados.get("id") ?? "");
  const ativo = dados.get("ativo") === "on";

  const supabase = await createServerClient();
  if (id) {
    const { error } = await supabase.from("servicos_extras").update({ ...r.data, ativo }).eq("id", id);
    if (error) return { erro: (console.error("[escritorio]", error.message), "Não foi possível concluir a operação. Tente novamente.") };
    await registrarAuditoria("servico_extra.atualizar", "servicos_extras", id, { ...r.data, ativo });
  } else {
    const { data, error } = await supabase.from("servicos_extras").insert(r.data).select("id").single();
    if (error || !data) return { erro: (console.error("[escritorio]", error?.message), "Não foi possível concluir a operação. Tente novamente.") };
    await registrarAuditoria("servico_extra.criar", "servicos_extras", data.id, r.data);
  }
  revalidatePath("/escritorio/servicos-extras");
  return { ok: true };
}
