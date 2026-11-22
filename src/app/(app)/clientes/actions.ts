"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obterCliente } from "@/db/clientes";
import { clienteSchema, socioSchema } from "@/domain/clientes-schema";
import { pendenciasCadastro } from "@/domain/completude";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

const ROTULOS: Record<string, string> = {
  razao_social: "Razão social", documento: "CPF/CNPJ", codigo_dominio: "Código no Domínio", uf: "UF",
  cep: "CEP", email: "E-mail", regime: "Regime", nome: "Nome", cpf: "CPF", participacao: "Participação",
};

function falha(contexto: string, detalhe: string): string {
  console.error(`[clientes] ${contexto}: ${detalhe}`);
  return "Não foi possível concluir a operação. Tente novamente.";
}

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("clientes.editar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para editar clientes."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

function mensagens(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((i) => `${ROTULOS[String(i.path[0])] ?? String(i.path[0] ?? "")}: ${i.message}`).join(" · ");
}

const UUID_NULO = "00000000-0000-0000-0000-000000000000";

export async function salvarCliente(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const bruto = Object.fromEntries([...dados.entries()].filter(([, v]) => typeof v === "string"));
  const r = clienteSchema.safeParse(bruto);
  if (!r.success) return { erro: mensagens(r.error.issues) };

  const id = String(dados.get("id") ?? "");
  if (id && r.data.indicado_por === id) return { erro: "Um cliente não pode indicar a si mesmo." };

  const supabase = await createServerClient();
  const erroUnico = (code?: string) =>
    code === "23505" ? "Já existe um cliente com esse CPF/CNPJ ou código do Domínio." : null;

  if (id) {
    const { error } = await supabase.from("clientes").update(r.data).eq("id", id);
    if (error) return { erro: erroUnico(error.code) ?? falha("atualizar", error.message) };
    await registrarAuditoria("cliente.atualizar", "clientes", id, r.data);
    revalidatePath(`/clientes/${id}`);
    revalidatePath("/clientes");
    return { ok: true };
  }
  const { data, error } = await supabase.from("clientes").insert(r.data).select("id").single();
  if (error || !data) return { erro: erroUnico(error?.code) ?? falha("criar", error?.message ?? "sem retorno") };
  await registrarAuditoria("cliente.criar", "clientes", data.id, r.data);
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function confirmarCadastro(clienteId: string): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const c = await obterCliente(clienteId);
  if (!c) return { erro: "Cliente não encontrado." };
  if (c.situacao !== "a_revisar") return { erro: "Cadastro já confirmado ou cliente inativo." };
  if (pendenciasCadastro(c).includes("documento_invalido")) {
    return { erro: "Corrija o CPF/CNPJ do cliente antes de confirmar o cadastro." };
  }
  const supabase = await createServerClient();
  const { error } = await supabase.from("clientes").update({ situacao: "ativo" }).eq("id", clienteId);
  if (error) return { erro: falha("confirmar", error.message) };
  await registrarAuditoria("cliente.confirmar_cadastro", "clientes", clienteId, { de: c.situacao, para: "ativo" });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  return { ok: true };
}

export async function salvarSocio(_: Resultado, dados: FormData): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };

  const clienteId = String(dados.get("cliente_id") ?? "");
  const id = String(dados.get("id") ?? "");
  if (!clienteId) return { erro: "Cliente não informado." };
  const r = socioSchema.safeParse({
    nome: dados.get("nome") ?? "",
    cpf: dados.get("cpf") ?? "",
    participacao: dados.get("participacao") ?? "",
    administrador: dados.get("administrador") === "on",
  });
  if (!r.success) return { erro: mensagens(r.error.issues) };

  const supabase = await createServerClient();
  let anteriores: string[] = [];
  if (r.data.administrador) {
    // O índice único parcial permite 1 administrador: desmarca os demais antes.
    const { data: outros } = await supabase
      .from("socios")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("administrador", true)
      .neq("id", id || UUID_NULO);
    anteriores = (outros ?? []).map((o) => o.id);
    if (anteriores.length) {
      const { error } = await supabase.from("socios").update({ administrador: false }).in("id", anteriores);
      if (error) return { erro: falha("desmarcar administrador", error.message) };
    }
  }

  let sid = id;
  let erro: string | undefined;
  if (id) {
    const { error } = await supabase.from("socios").update(r.data).eq("id", id).eq("cliente_id", clienteId);
    erro = error?.message;
  } else {
    const { data, error } = await supabase.from("socios").insert({ ...r.data, cliente_id: clienteId }).select("id").single();
    erro = error?.message;
    sid = data?.id ?? "";
  }
  if (erro) {
    if (anteriores.length) await supabase.from("socios").update({ administrador: true }).in("id", anteriores);
    return { erro: falha("salvar sócio", erro) };
  }
  await registrarAuditoria(id ? "socio.atualizar" : "socio.criar", "socios", sid, { cliente_id: clienteId, ...r.data });
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

export async function removerSocio(clienteId: string, socioId: string): Promise<Resultado> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const supabase = await createServerClient();
  const { error } = await supabase.from("socios").delete().eq("id", socioId).eq("cliente_id", clienteId);
  if (error) return { erro: falha("remover sócio", error.message) };
  await registrarAuditoria("socio.remover", "socios", socioId, { cliente_id: clienteId });
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
