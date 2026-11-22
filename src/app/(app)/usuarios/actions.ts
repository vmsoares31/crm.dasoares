"use server";

import { revalidatePath } from "next/cache";

import { alteracaoDeixaSemAdministrador, type Papel } from "@/domain/permissoes";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { urlCallback } from "@/lib/site";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export type Resultado = { ok?: boolean; erro?: string };

const PAPEIS: Papel[] = ["administrador", "colaborador"];

function erroPermissao(e: unknown): string {
  return e instanceof SemPermissaoError
    ? "Você não tem permissão para gerenciar usuários."
    : "Não foi possível verificar suas permissões. Tente novamente.";
}

export async function convidarUsuario(_: Resultado, dados: FormData): Promise<Resultado> {
  try {
    await exigirPermissao("usuarios.gerenciar");
  } catch (e) {
    return { erro: erroPermissao(e) };
  }
  const email = String(dados.get("email") ?? "").trim();
  const nome = String(dados.get("nome") ?? "").trim();
  const papel = String(dados.get("papel") ?? "") as Papel;
  if (!email || !nome || !PAPEIS.includes(papel)) return { erro: "Preencha nome, e-mail e papel." };

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return {
      erro: "Chave de serviço do Supabase não configurada (SUPABASE_SERVICE_ROLE_KEY). Contate o responsável técnico.",
    };
  }

  let usuarioId: string | undefined;
  const convite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome },
    redirectTo: urlCallback(),
  });
  if (convite.data.user) {
    usuarioId = convite.data.user.id;
  } else {
    // Possível reenvio após falha parcial: o usuário já existe no Auth.
    for (let pagina = 1; !usuarioId; pagina++) {
      const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (erroLista) break;
      usuarioId = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
      if (lista.users.length < 200) break;
    }
    if (!usuarioId) {
      return { erro: `Não foi possível enviar o convite: ${convite.error?.message ?? "erro desconhecido"}` };
    }
  }

  const { error: erroPerfil } = await admin
    .from("perfis")
    .upsert({ usuario_id: usuarioId, nome, papel, ativo: true });
  if (erroPerfil) {
    return { erro: `Falha ao criar o perfil: ${erroPerfil.message}. Tente convidar novamente.` };
  }

  await registrarAuditoria("usuario.convidar", "perfis", usuarioId, { email, papel });
  revalidatePath("/usuarios");
  return { ok: true };
}

async function alterarPerfil(
  usuarioId: string,
  alteracao: { papel?: Papel; ativo?: boolean },
  acaoAuditoria: string,
): Promise<Resultado> {
  try {
    await exigirPermissao("usuarios.gerenciar");
  } catch (e) {
    return { erro: erroPermissao(e) };
  }
  const supabase = await createServerClient();
  const { data: perfis, error: erroLista } = await supabase
    .from("perfis")
    .select("usuario_id, papel, ativo");
  if (erroLista || !perfis) return { erro: "Não foi possível carregar os usuários." };

  const resumo = perfis.map((p) => ({ id: p.usuario_id, papel: p.papel as Papel, ativo: p.ativo }));
  if (!resumo.some((p) => p.id === usuarioId)) return { erro: "Usuário não encontrado." };
  if (alteracaoDeixaSemAdministrador(resumo, usuarioId, alteracao)) {
    return { erro: "Não é possível rebaixar ou desativar o último administrador ativo." };
  }

  const { error } = await supabase.from("perfis").update(alteracao).eq("usuario_id", usuarioId);
  if (error) return { erro: `Falha ao atualizar: ${error.message}` };

  await registrarAuditoria(acaoAuditoria, "perfis", usuarioId, alteracao);
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function mudarPapel(usuarioId: string, papel: Papel): Promise<Resultado> {
  if (!PAPEIS.includes(papel)) return { erro: "Papel inválido." };
  return alterarPerfil(usuarioId, { papel }, "usuario.mudar_papel");
}

export async function definirAtivo(usuarioId: string, ativo: boolean): Promise<Resultado> {
  return alterarPerfil(usuarioId, { ativo }, ativo ? "usuario.ativar" : "usuario.desativar");
}
