"use server";

import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

export type EstadoSenha = { erro?: string };

export async function definirSenha(_: EstadoSenha, dados: FormData): Promise<EstadoSenha> {
  const senha = String(dados.get("senha") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");
  if (senha.length < 8) return { erro: "A senha deve ter pelo menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "A confirmação não confere com a senha." };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Link expirado ou inválido. Solicite um novo." };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "Não foi possível definir a senha. Tente novamente." };

  redirect("/inicio");
}
