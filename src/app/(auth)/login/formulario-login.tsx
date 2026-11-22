"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { entrar, type EstadoLogin } from "./actions";

export function FormularioLogin({ erroLink }: { erroLink?: boolean }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <form action={acao} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Use o e-mail e a senha cadastrados no escritório.</p>
      </div>
      <label className="block space-y-1.5 text-sm font-semibold">
        <span>E-mail</span>
        <input name="email" type="email" required autoComplete="email" placeholder="voce@dasoares.com.br" className="campo w-full font-normal" />
      </label>
      <label className="block space-y-1.5 text-sm font-semibold">
        <span>Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" className="campo w-full font-normal" />
      </label>
      {(estado.erro || erroLink) && (
        <Mensagem tipo="erro">{estado.erro ?? "Link expirado ou inválido. Solicite um novo."}</Mensagem>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pendente}>
        {pendente ? "Entrando..." : "Entrar"}
      </Button>
      <Link href="/recuperar-senha" className="link block text-center text-sm">
        Esqueci minha senha
      </Link>
    </form>
  );
}
