"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { Papel } from "@/domain/permissoes";
import { definirAtivo, mudarPapel } from "./actions";

type Props = { id: string; nome: string; papel: Papel; ativo: boolean };

export function LinhaUsuario({ id, nome, papel, ativo }: Props) {
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function executar(fn: () => Promise<{ erro?: string }>) {
    setErro(undefined);
    iniciar(async () => {
      const r = await fn();
      if (r.erro) setErro(r.erro);
    });
  }

  return (
    <tr className="border-b">
      <td className="p-2">{nome}</td>
      <td className="p-2">
        <select
          value={papel}
          disabled={pendente}
          onChange={(e) => executar(() => mudarPapel(id, e.target.value as Papel))}
          className="rounded border px-2 py-1"
        >
          <option value="colaborador">Colaborador</option>
          <option value="administrador">Administrador</option>
        </select>
      </td>
      <td className="p-2">{ativo ? "Ativo" : "Inativo"}</td>
      <td className="p-2">
        <Button size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => definirAtivo(id, !ativo))}>
          {ativo ? "Desativar" : "Ativar"}
        </Button>
        {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
      </td>
    </tr>
  );
}
