"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { salvarServicoExtra, type Resultado } from "./actions";

type Props = { id?: string; nome?: string; valor?: string; ativo?: boolean; somenteLeitura: boolean };

export function FormularioServico({ id, nome = "", valor = "", ativo = true, somenteLeitura }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarServicoExtra, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 border-b py-2">
      <input type="hidden" name="id" value={id ?? ""} />
      <fieldset disabled={somenteLeitura} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span>Nome</span>
          <input name="nome" required defaultValue={nome} className="block rounded border px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span>Valor</span>
          <input name="valor" required defaultValue={valor} placeholder="R$ 50,00" className="block rounded border px-3 py-2" /></label>
        {id ? (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={ativo} /> Ativo</label>
        ) : (
          <input type="hidden" name="ativo" value="on" />
        )}
        <Button type="submit" disabled={pendente}>{id ? "Salvar" : "Adicionar"}</Button>
      </fieldset>
      {estado.erro && <p role="alert" className="w-full text-sm text-red-600">{estado.erro}</p>}
      {estado.ok && <p role="status" className="w-full text-sm text-green-700">Salvo.</p>}
    </form>
  );
}
