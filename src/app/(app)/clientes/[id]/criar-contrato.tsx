"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { criarContrato } from "../../contratos/actions";

export function CriarContrato({ clienteId }: { clienteId: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button type="button" disabled={pendente} onClick={() => iniciar(async () => setErro((await criarContrato(clienteId))?.erro ?? null))}>
        Criar contrato
      </Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
