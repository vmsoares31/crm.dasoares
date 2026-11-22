"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { entrar, type EstadoLogin } from "./actions";

export default function LoginPage() {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={acao} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">CRM D.A. Soares</h1>
        <label className="block space-y-1 text-sm">
          <span>E-mail</span>
          <input name="email" type="email" required autoComplete="email" className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Senha</span>
          <input name="senha" type="password" required autoComplete="current-password" className="w-full rounded border px-3 py-2" />
        </label>
        {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
        <Button type="submit" className="w-full" disabled={pendente}>
          {pendente ? "Entrando..." : "Entrar"}
        </Button>
        <Link href="/recuperar-senha" className="block text-center text-sm underline">
          Esqueci minha senha
        </Link>
      </form>
    </main>
  );
}
