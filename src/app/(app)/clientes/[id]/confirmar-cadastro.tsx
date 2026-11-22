"use client";

import { useState, useTransition } from "react";

import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { confirmarCadastro } from "../actions";

export function ConfirmarCadastro({ clienteId, bloqueado }: { clienteId: string; bloqueado: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        disabled={pendente || bloqueado}
        onClick={() => iniciar(async () => setErro((await confirmarCadastro(clienteId)).erro ?? null))}
      >
        <CircleCheck aria-hidden /> Confirmar cadastro
      </Button>
      {bloqueado && <p className="text-xs text-muted-foreground">Corrija o CPF/CNPJ para poder confirmar.</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
