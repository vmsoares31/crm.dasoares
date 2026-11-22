"use server";

import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

export type EstadoSenha = { erro?: string };

const LINK_INVALIDO = "Link expirado ou inválido. Solicite um novo.";

export async function definirSenha(_: EstadoSenha, dados: FormData): Promise<EstadoSenha> {
  const senha = String(dados.get("senha") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "A confirmação não confere com a senha." };

  const supabase = await createServerClient();

  // Fluxo implícito: tokens vindos do hash da URL, gravados em cookie pelo servidor.
  const accessToken = String(dados.get("access_token") ?? "");
  const refreshToken = String(dados.get("refresh_token") ?? "");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { erro: LINK_INVALIDO };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: LINK_INVALIDO };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível definir a senha. Tente novamente." };

  redirect("/inicio");
}
