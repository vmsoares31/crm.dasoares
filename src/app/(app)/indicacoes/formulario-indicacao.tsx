"use client";

import { useActionState, useRef } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { registrar, type Resultado } from "./actions";

type Opcao = { id: string; razao_social: string };
type Props = {
  indicadores: Opcao[];
  /** Opções de indicado; ignorado quando `indicadoFixo` é informado (ficha do cliente). */
  indicados?: Opcao[];
  indicadoFixo?: string;
};

export function FormularioIndicacao({ indicadores, indicados = [], indicadoFixo }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(async (anterior, dados) => {
    const r = await registrar(anterior, dados);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});

  return (
    <form ref={formRef} action={acao} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium"><span>Quem indicou</span>
        <select name="indicador_id" required defaultValue="" className="campo w-full font-normal">
          <option value="" disabled>Selecione…</option>
          {indicadores.filter((c) => c.id !== indicadoFixo).map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select></label>
      {indicadoFixo ? (
        <input type="hidden" name="indicado_id" value={indicadoFixo} />
      ) : (
        <label className="space-y-1.5 text-sm font-medium"><span>Cliente indicado</span>
          <select name="indicado_id" required defaultValue="" className="campo w-full font-normal">
            <option value="" disabled>Selecione…</option>
            {indicados.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select></label>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pendente}>Registrar indicação</Button>
        {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
        {estado.ok && <Mensagem tipo="ok">{estado.mensagem}</Mensagem>}
      </div>
    </form>
  );
}
