"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { recuperarSenha } from "../login/actions";

export default function RecuperarSenhaPage() {
  const [estado, acao, pendente] = useActionState(recuperarSenha, {});
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={acao} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Recuperar senha</h1>
        <label className="block space-y-1 text-sm">
          <span>E-mail</span>
          <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
        </label>
        {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
        {estado.ok && (
          <p role="status" className="text-sm text-green-700">
            Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pendente}>Enviar link</Button>
        <Link href="/login" className="block text-center text-sm underline">Voltar ao login</Link>
      </form>
    </main>
  );
}
