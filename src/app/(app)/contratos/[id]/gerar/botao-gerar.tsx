"use client";

import { FileText } from "lucide-react";
import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { gerarContrato, type ResultadoGeracao } from "./actions";

export function BotaoGerarContrato({ contratoId, bloqueio }: { contratoId: string; bloqueio: string | null }) {
  const [estado, acao, pendente] = useActionState<ResultadoGeracao, FormData>(() => gerarContrato(contratoId), {});
  return (
    <div className="space-y-2">
      <form action={acao}>
        <Button type="submit" disabled={!!bloqueio || pendente}>
          <FileText aria-hidden="true" />
          {pendente ? "Gerando…" : "Gerar contrato"}
        </Button>
      </form>
      {bloqueio && <p className="text-sm text-muted-foreground">{bloqueio}</p>}
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.ok && <Mensagem tipo="ok">Contrato gerado.</Mensagem>}
      {estado.aviso && (
        <p role="status" className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
          {estado.aviso}
        </p>
      )}
    </div>
  );
}
