"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cancelarExtra } from "./actions";

export function BotaoCancelarExtra({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pendente}
        onClick={() => {
          if (!window.confirm("Cancelar este extra?")) return;
          iniciar(async () => {
            const r = await cancelarExtra(id);
            setErro(r.erro ?? null);
          });
        }}
      >
        Cancelar
      </Button>
      {erro && <span role="alert" className="text-xs text-destructive">{erro}</span>}
    </span>
  );
}
