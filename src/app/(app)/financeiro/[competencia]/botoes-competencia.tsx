"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { abrirMes, regerarPrevistas, type ResultadoAcao } from "./actions";

export function BotoesCompetencia({ competencia, temCobrancas, previstas }: { competencia: string; temCobrancas: boolean; previstas: number }) {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);

  function abrir() {
    iniciar(async () => setResultado(await abrirMes(competencia)));
  }

  function regerar() {
    const ok = window.confirm(
      `As ${previstas} cobrança(s) prevista(s) serão apagadas e geradas de novo — ajustes manuais nelas serão perdidos. ` +
        "Cobranças emitidas, pagas e canceladas não mudam. Continuar?",
    );
    if (!ok) return;
    iniciar(async () => setResultado(await regerarPrevistas(competencia)));
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={temCobrancas ? "outline" : "default"} disabled={pendente} onClick={abrir}
          title={temCobrancas ? "Gera só as cobranças que ainda não existem" : undefined}>
          Abrir mês
        </Button>
        {temCobrancas && (
          <Button type="button" disabled={pendente} onClick={regerar}>
            <RefreshCw aria-hidden />
            Regerar previstas
          </Button>
        )}
      </div>
      {pendente && <p role="status" className="text-sm text-muted-foreground">Processando…</p>}
      {!pendente && resultado?.erro && <Mensagem tipo="erro">{resultado.erro}</Mensagem>}
      {!pendente && resultado?.mensagem && <Mensagem tipo="ok">{resultado.mensagem}</Mensagem>}
    </div>
  );
}
