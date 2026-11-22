"use client";

import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { salvarCarteira, type Resultado } from "./actions";

type Props = { id?: string; nome?: string; saida?: string; ativa?: boolean; somenteLeitura: boolean };

export function FormularioCarteira({ id, nome = "", saida = "csv_cora", ativa = true, somenteLeitura }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarCarteira, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 px-5 py-4">
      <input type="hidden" name="id" value={id ?? ""} />
      <fieldset disabled={somenteLeitura} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium"><span>Nome</span>
          <input name="nome" required defaultValue={nome} className="campo font-normal" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Forma de saída</span>
          <select name="saida" defaultValue={saida} className="campo font-normal">
            <option value="csv_cora">CSV Cora</option>
            <option value="lista_manual">Lista manual</option>
          </select></label>
        {id ? (
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input type="checkbox" name="ativa" defaultChecked={ativa} /> Ativa</label>
        ) : (
          <input type="hidden" name="ativa" value="on" />
        )}
        <Button type="submit" disabled={pendente}>{id ? "Salvar" : "Adicionar"}</Button>
      </fieldset>
      {estado.erro && <Mensagem tipo="erro" className="w-full">{estado.erro}</Mensagem>}
      {estado.ok && <Mensagem tipo="ok" className="w-full">Salvo.</Mensagem>}
    </form>
  );
}
