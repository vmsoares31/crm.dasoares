"use client";

import { useState, useTransition } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { baixar } from "./actions";

/** Botão "Baixar" que abre um pequeno formulário com o motivo (obrigatório). */
export function BaixarIndicacao({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return <Button type="button" size="sm" variant="outline" onClick={() => setAberto(true)}>Baixar</Button>;
  }
  return (
    <form
      className="flex min-w-64 flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await baixar(id, motivo);
          if (r.erro) setErro(r.erro);
          else setAberto(false);
        });
      }}
    >
      <label className="space-y-1 text-xs font-medium">
        <span>Motivo da baixa (o indicado não pagou)</span>
        <input className="campo w-full font-normal" value={motivo} onChange={(e) => setMotivo(e.target.value)} required maxLength={300} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pendente || !motivo.trim()}>Confirmar baixa</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={() => setAberto(false)}>Voltar</Button>
      </div>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
    </form>
  );
}
