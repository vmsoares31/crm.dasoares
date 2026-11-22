"use client";

import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { convidarUsuario, type Resultado } from "./actions";

export function FormularioConvite() {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(convidarUsuario, {});
  return (
    <Card className="px-5">
      <h2 className="font-heading text-base font-bold">Convidar usuário</h2>
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium"><span>Nome</span>
          <input name="nome" required className="campo font-normal" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>E-mail</span>
          <input name="email" type="email" required className="campo font-normal" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Papel</span>
          <select name="papel" defaultValue="colaborador" className="campo font-normal">
            <option value="colaborador">Colaborador</option>
            <option value="administrador">Administrador</option>
          </select></label>
        <Button type="submit" disabled={pendente}>Convidar</Button>
        {estado.erro && <Mensagem tipo="erro" className="w-full">{estado.erro}</Mensagem>}
        {estado.ok && <Mensagem tipo="ok" className="w-full">Convite enviado.</Mensagem>}
      </form>
    </Card>
  );
}
