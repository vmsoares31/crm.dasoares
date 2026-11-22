import "server-only";

import { forbidden } from "next/navigation";

import { pode, type Acao, type Papel } from "@/domain/permissoes";
import { createServerClient } from "@/lib/supabase/server";

export type Usuario = {
  id: string;
  email: string | null;
  nome: string;
  papel: Papel;
  permissoes: string[];
};

/** Usuário logado com perfil ativo e permissões; null se não houver. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, papel, ativo")
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (!perfil || !perfil.ativo) return null;

  const { data: perms } = await supabase
    .from("permissoes")
    .select("acao")
    .eq("papel", perfil.papel);

  return {
    id: user.id,
    email: user.email ?? null,
    nome: perfil.nome,
    papel: perfil.papel as Papel,
    permissoes: (perms ?? []).map((p) => p.acao),
  };
}

export class SemPermissaoError extends Error {
  constructor(acao: string) {
    super(`Sem permissão para: ${acao}.`);
  }
}

/** Para Server Actions: lança erro se não puder. */
export async function exigirPermissao(acao: Acao): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario.permissoes, acao)) throw new SemPermissaoError(acao);
  return usuario;
}

/** Para páginas: responde 403 (forbidden) se não puder. */
export async function exigirPermissaoPagina(acao: Acao): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario.permissoes, acao)) forbidden();
  return usuario;
}
