"use server";

import { revalidatePath } from "next/cache";

import { escritorioSchema } from "@/domain/escritorio-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

const MAX_MODELO = 5 * 1024 * 1024;
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("escritorio.editar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para editar o cadastro do escritório."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

export async function salvarEscritorio(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const bruto = Object.fromEntries([...dados.entries()].filter(([, v]) => typeof v === "string"));
  const r = escritorioSchema.safeParse(bruto);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${String(i.path[0] ?? "")}: ${i.message}`).join(" · ");
    return { erro: msg };
  }

  const supabase = await createServerClient();
  const { data: atual } = await supabase.from("escritorio").select("id").limit(1).single();
  if (!atual) return { erro: "Cadastro do escritório não encontrado." };

  const { error } = await supabase.from("escritorio").update(r.data).eq("id", atual.id);
  if (error) return { erro: `Falha ao salvar: ${error.message}` };

  await registrarAuditoria("escritorio.atualizar", "escritorio", atual.id, r.data);
  revalidatePath("/escritorio");
  return { ok: true };
}

export async function enviarModelo(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const arquivo = dados.get("modelo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Selecione um arquivo .docx." };
  if (!arquivo.name.toLowerCase().endsWith(".docx")) return { erro: "O modelo deve ser um arquivo .docx." };
  if (arquivo.type && arquivo.type !== MIME_DOCX) return { erro: "O arquivo não parece ser um .docx válido." };
  if (arquivo.size > MAX_MODELO) return { erro: "O arquivo excede o limite de 5 MB." };

  const supabase = await createServerClient();
  const { data: atual } = await supabase.from("escritorio").select("id, modelo_contrato_path").limit(1).single();
  if (!atual) return { erro: "Cadastro do escritório não encontrado." };

  const caminho = `modelo/contrato-padrao-${Date.now()}.docx`;
  const { error: erroUp } = await supabase.storage
    .from("contratos")
    .upload(caminho, arquivo, { contentType: MIME_DOCX, upsert: false });
  if (erroUp) return { erro: `Falha ao enviar o arquivo: ${erroUp.message}` };

  const { error } = await supabase.from("escritorio").update({ modelo_contrato_path: caminho }).eq("id", atual.id);
  if (error) {
    await supabase.storage.from("contratos").remove([caminho]);
    return { erro: `Falha ao salvar o modelo: ${error.message}` };
  }
  if (atual.modelo_contrato_path) {
    await supabase.storage.from("contratos").remove([atual.modelo_contrato_path]);
  }

  await registrarAuditoria("escritorio.modelo_substituir", "escritorio", atual.id, { caminho });
  revalidatePath("/escritorio");
  return { ok: true };
}

export async function restaurarModeloPadrao(): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const supabase = await createServerClient();
  const { data: atual } = await supabase.from("escritorio").select("id, modelo_contrato_path").limit(1).single();
  if (!atual) return { erro: "Cadastro do escritório não encontrado." };
  const { error } = await supabase.from("escritorio").update({ modelo_contrato_path: null }).eq("id", atual.id);
  if (error) return { erro: `Falha ao restaurar: ${error.message}` };
  if (atual.modelo_contrato_path) {
    await supabase.storage.from("contratos").remove([atual.modelo_contrato_path]);
  }
  await registrarAuditoria("escritorio.modelo_restaurar", "escritorio", atual.id);
  revalidatePath("/escritorio");
  return { ok: true };
}
