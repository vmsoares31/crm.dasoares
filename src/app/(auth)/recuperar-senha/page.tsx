"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { recuperarSenha } from "../login/actions";

export default function RecuperarSenhaPage() {
  const [estado, acao, pendente] = useActionState(recuperarSenha, {});
  return (
    <form action={acao} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-extrabold">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">Enviaremos um link para você criar uma nova senha.</p>
      </div>
      <label className="block space-y-1.5 text-sm font-semibold">
        <span>E-mail</span>
        <input name="email" type="email" required className="campo w-full font-normal" />
      </label>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.ok && (
        <Mensagem tipo="ok">Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.</Mensagem>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pendente}>Enviar link</Button>
      <Link href="/login" className="link block text-center text-sm">Voltar ao login</Link>
    </form>
  );
}
