"use server";

import { redirect } from "next/navigation";

import { urlCallback } from "@/lib/site";
import { createServerClient } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string };

export async function entrar(_: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");
  if (!email || !senha) return { erro: "E-mail ou senha inválidos" };

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.user) return { erro: "E-mail ou senha inválidos" };

  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo")
    .eq("usuario_id", data.user.id)
    .maybeSingle();
  if (!perfil || !perfil.ativo) {
    await supabase.auth.signOut();
    return { erro: "Usuário inativo ou sem perfil. Procure o administrador." };
  }

  redirect("/inicio");
}

export async function sair() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function recuperarSenha(
  _: { erro?: string; ok?: boolean },
  dados: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const email = String(dados.get("email") ?? "").trim();
  if (!email) return { erro: "Informe o e-mail." };
  const supabase = await createServerClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlCallback() });
  // Resposta neutra para não revelar quais e-mails existem.
  return { ok: true };
}
