"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SituacaoBadge } from "@/components/situacao-badge";
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
    <tr>
      <td className="font-medium">{nome}</td>
      <td>
        <select
          value={papel}
          disabled={pendente}
          onChange={(e) => executar(() => mudarPapel(id, e.target.value as Papel))}
          className="campo campo-compacto"
        >
          <option value="colaborador">Colaborador</option>
          <option value="administrador">Administrador</option>
        </select>
      </td>
      <td><SituacaoBadge situacao={ativo ? "ativo" : "inativo"} /></td>
      <td>
        <Button size="sm" variant="outline" disabled={pendente} onClick={() => executar(() => definirAtivo(id, !ativo))}>
          {ativo ? "Desativar" : "Ativar"}
        </Button>
        {erro && <p role="alert" className="mt-1 text-xs text-destructive">{erro}</p>}
      </td>
    </tr>
  );
}
