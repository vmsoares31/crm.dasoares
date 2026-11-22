"use server";

import { revalidatePath } from "next/cache";

import { carteiraSchema } from "@/domain/escritorio-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

export async function salvarCarteira(_: Resultado, dados: FormData): Promise<Resultado> {
  try {
    await exigirPermissao("escritorio.editar");
  } catch {
    return { erro: "Você não tem permissão para editar carteiras." };
  }
  const r = carteiraSchema.safeParse({ nome: dados.get("nome") ?? "", saida: dados.get("saida") ?? "" });
  if (!r.success) return { erro: r.error.issues.map((i) => i.message).join(" ") };
  const id = String(dados.get("id") ?? "");
  const ativa = dados.get("ativa") === "on";

  const supabase = await createServerClient();
  if (id) {
    const { error } = await supabase.from("carteiras").update({ ...r.data, ativa }).eq("id", id);
    if (error) return { erro: error.code === "23505" ? "Já existe uma carteira com esse nome." : (console.error("[escritorio]", error.message), "Não foi possível concluir a operação. Tente novamente.") };
    await registrarAuditoria("carteira.atualizar", "carteiras", id, { ...r.data, ativa });
  } else {
    const { data, error } = await supabase.from("carteiras").insert(r.data).select("id").single();
    if (error || !data) return { erro: error?.code === "23505" ? "Já existe uma carteira com esse nome." : (console.error("[escritorio]", error?.message), "Não foi possível concluir a operação. Tente novamente.") };
    await registrarAuditoria("carteira.criar", "carteiras", data.id, r.data);
  }
  revalidatePath("/escritorio/carteiras");
  return { ok: true };
}
