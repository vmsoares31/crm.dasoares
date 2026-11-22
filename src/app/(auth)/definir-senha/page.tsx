"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { definirSenha, type EstadoSenha } from "./actions";

const LINK_INVALIDO = "Link expirado ou inválido. Solicite um novo.";

export default function DefinirSenhaPage() {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(definirSenha, {});
  const [erroLink, setErroLink] = useState<string>();
  const [tokens, setTokens] = useState<{ access: string; refresh: string }>();

  // Fluxo implícito: tokens chegam no hash da URL; são enviados ao servidor no formulário.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error_description") || hash.get("error")) {
      setErroLink(LINK_INVALIDO);
    } else if (hash.get("access_token") && hash.get("refresh_token")) {
      setTokens({ access: hash.get("access_token")!, refresh: hash.get("refresh_token")! });
    }
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <form action={acao} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground">A senha precisa ter pelo menos 8 caracteres.</p>
      </div>
      {tokens && <input type="hidden" name="access_token" value={tokens.access} />}
      {tokens && <input type="hidden" name="refresh_token" value={tokens.refresh} />}
      <label className="block space-y-1.5 text-sm font-semibold">
        <span>Nova senha</span>
        <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="campo w-full font-normal" />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">
        <span>Confirmar senha</span>
        <input name="confirmacao" type="password" required minLength={8} autoComplete="new-password" className="campo w-full font-normal" />
      </label>
      {(erroLink || estado.erro) && <Mensagem tipo="erro">{erroLink ?? estado.erro}</Mensagem>}
      <Button type="submit" size="lg" className="w-full" disabled={pendente || !!erroLink}>Salvar senha</Button>
      {erroLink && (
        <Link href="/recuperar-senha" className="link block text-center text-sm">Solicitar novo link</Link>
      )}
    </form>
  );
}
