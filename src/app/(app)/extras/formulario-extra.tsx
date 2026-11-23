"use client";

import { useActionState, useRef, useState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { lancarExtra, type Resultado } from "./actions";

type Servico = { id: string; nome: string; valor: string };
type Props = {
  clientes: { id: string; razao_social: string }[];
  servicos: Servico[];
  competenciaPadrao: string;
  dataPadrao: string;
};

export function FormularioExtra({ clientes, servicos, competenciaPadrao, dataPadrao }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(
    async (anterior, dados) => {
      const r = await lancarExtra(anterior, dados);
      if (r.ok) {
        formRef.current?.reset();
        setDescricao("");
        setValor("");
      }
      return r;
    },
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

  function escolherServico(id: string) {
    const s = servicos.find((x) => x.id === id);
    if (s) {
      setDescricao(s.nome);
      setValor(s.valor);
    }
  }

  return (
    <form ref={formRef} action={acao} className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1.5 text-sm font-medium"><span>Cliente</span>
        <select name="cliente_id" required defaultValue="" className="campo w-full font-normal">
          <option value="" disabled>Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Serviço da tabela</span>
        <select name="servico_id" defaultValue="" onChange={(e) => escolherServico(e.target.value)} className="campo w-full font-normal">
          <option value="">Outro (avulso)</option>
          {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — {s.valor}</option>)}
        </select></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Descrição</span>
        <input name="descricao" required value={descricao} onChange={(e) => setDescricao(e.target.value)} className="campo w-full font-normal" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Valor</span>
        <input name="valor" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 50,00" inputMode="decimal" className="campo w-full font-normal tabular-nums" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Data do serviço</span>
        <input type="date" name="data" required defaultValue={dataPadrao} className="campo w-full font-normal" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Competência</span>
        <input type="month" name="competencia" required defaultValue={competenciaPadrao} className="campo w-full font-normal" /></label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3"><span>Observação</span>
        <input name="observacao" className="campo w-full font-normal" /></label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pendente}>Lançar extra</Button>
        {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
        {estado.ok && <Mensagem tipo="ok">Extra lançado.</Mensagem>}
      </div>
    </form>
  );
}
