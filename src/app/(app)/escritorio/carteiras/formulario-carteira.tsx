"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { salvarCarteira, type Resultado } from "./actions";

type Props = { id?: string; nome?: string; saida?: string; ativa?: boolean; somenteLeitura: boolean };

export function FormularioCarteira({ id, nome = "", saida = "csv_cora", ativa = true, somenteLeitura }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarCarteira, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 border-b py-2">
      <input type="hidden" name="id" value={id ?? ""} />
      <fieldset disabled={somenteLeitura} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span>Nome</span>
          <input name="nome" required defaultValue={nome} className="block rounded border px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span>Forma de saída</span>
          <select name="saida" defaultValue={saida} className="block rounded border px-3 py-2">
            <option value="csv_cora">CSV Cora</option>
            <option value="lista_manual">Lista manual</option>
          </select></label>
        {id ? (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="ativa" defaultChecked={ativa} /> Ativa</label>
        ) : (
          <input type="hidden" name="ativa" value="on" />
        )}
        <Button type="submit" disabled={pendente}>{id ? "Salvar" : "Adicionar"}</Button>
      </fieldset>
      {estado.erro && <p role="alert" className="w-full text-sm text-red-600">{estado.erro}</p>}
      {estado.ok && <p role="status" className="w-full text-sm text-green-700">Salvo.</p>}
    </form>
  );
}
