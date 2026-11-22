"use client";

import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { salvarServicoExtra, type Resultado } from "./actions";

type Props = { id?: string; nome?: string; valor?: string; ativo?: boolean; somenteLeitura: boolean };

export function FormularioServico({ id, nome = "", valor = "", ativo = true, somenteLeitura }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarServicoExtra, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 px-5 py-4">
      <input type="hidden" name="id" value={id ?? ""} />
      <fieldset disabled={somenteLeitura} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium"><span>Nome</span>
          <input name="nome" required defaultValue={nome} className="campo font-normal" /></label>
        <label className="space-y-1.5 text-sm font-medium"><span>Valor</span>
          <input name="valor" required defaultValue={valor} placeholder="R$ 50,00" className="campo w-36 font-normal tabular-nums" /></label>
        {id ? (
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={ativo} /> Ativo</label>
        ) : (
          <input type="hidden" name="ativo" value="on" />
        )}
        <Button type="submit" disabled={pendente}>{id ? "Salvar" : "Adicionar"}</Button>
      </fieldset>
      {estado.erro && <Mensagem tipo="erro" className="w-full">{estado.erro}</Mensagem>}
      {estado.ok && <Mensagem tipo="ok" className="w-full">Salvo.</Mensagem>}
    </form>
  );
}
