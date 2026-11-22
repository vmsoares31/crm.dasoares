"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { definirSenha, type EstadoSenha } from "./actions";

export default function DefinirSenhaPage() {
  const [estado, acao, pendente] = useActionState<EstadoSenha, FormData>(definirSenha, {});
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
        {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
        <Button type="submit" className="w-full" disabled={pendente}>Salvar senha</Button>
      </form>
    </main>
  );
}
