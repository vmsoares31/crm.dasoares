"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/client";
import { definirSenha, type EstadoSenha } from "./actions";

const LINK_INVALIDO = "Link expirado ou inválido. Solicite um novo.";

export default function DefinirSenhaPage() {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(definirSenha, {});
  const [erroLink, setErroLink] = useState<string>();

  // Fluxo implícito: tokens chegam no hash da URL (#access_token=...&refresh_token=...).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error_description") || hash.get("error")) {
      setErroLink(LINK_INVALIDO);
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) return;
    createBrowserClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) setErroLink(LINK_INVALIDO);
        else window.history.replaceState(null, "", window.location.pathname);
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={acao} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Definir nova senha</h1>
        <label className="block space-y-1 text-sm">
          <span>Nova senha</span>
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Confirmar senha</span>
          <input name="confirmacao" type="password" required minLength={8} autoComplete="new-password" className="w-full rounded border px-3 py-2" />
        </label>
        {(erroLink || estado.erro) && (
          <p role="alert" className="text-sm text-red-600">{erroLink ?? estado.erro}</p>
        )}
        <Button type="submit" className="w-full" disabled={pendente || !!erroLink}>Salvar senha</Button>
        {erroLink && (
          <Link href="/recuperar-senha" className="block text-center text-sm underline">Solicitar novo link</Link>
        )}
      </form>
    </main>
  );
}
