"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { convidarUsuario, type Resultado } from "./actions";

export function FormularioConvite() {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(convidarUsuario, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <label className="space-y-1 text-sm"><span>Nome</span>
        <input name="nome" required className="block rounded border px-3 py-2" /></label>
      <label className="space-y-1 text-sm"><span>E-mail</span>
        <input name="email" type="email" required className="block rounded border px-3 py-2" /></label>
      <label className="space-y-1 text-sm"><span>Papel</span>
        <select name="papel" defaultValue="colaborador" className="block rounded border px-3 py-2">
          <option value="colaborador">Colaborador</option>
          <option value="administrador">Administrador</option>
        </select></label>
      <Button type="submit" disabled={pendente}>Convidar</Button>
      {estado.erro && <p role="alert" className="w-full text-sm text-red-600">{estado.erro}</p>}
      {estado.ok && <p role="status" className="w-full text-sm text-green-700">Convite enviado.</p>}
    </form>
  );
}
