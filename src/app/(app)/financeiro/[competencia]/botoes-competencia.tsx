"use client";

import { useState, useTransition } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { abrirMes, regerarPrevistas, type ResultadoAcao } from "./actions";

export function BotoesCompetencia({ competencia, temCobrancas, previstas }: { competencia: string; temCobrancas: boolean; previstas: number }) {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null);
  const [exportadas, setExportadas] = useState<number | null>(null);

  function abrir() {
    setExportadas(null);
    iniciar(async () => setResultado(await abrirMes(competencia)));
  }

  function enviarRegerar(confirmarDescarteExportacao: boolean) {
    setExportadas(null);
    iniciar(async () => {
      const r = await regerarPrevistas(competencia, { confirmarDescarteExportacao });
      if (r.exportadasPendentes) {
        setExportadas(r.exportadasPendentes);
        setResultado(null);
      } else {
        setResultado(r);
      }
    });
  }

  function regerar() {
    const ok = window.confirm(
      `As ${previstas} cobrança(s) prevista(s) serão apagadas e geradas de novo — ajustes manuais nelas serão perdidos. ` +
        "Cobranças emitidas, pagas e excluídas do mês não mudam; canceladas ganham uma cobrança substituta. Continuar?",
    );
    if (!ok) return;
    enviarRegerar(false);
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
      {exportadas !== null && !pendente && (
        <div role="alertdialog" aria-labelledby="aviso-exportadas" className="max-w-md space-y-3 rounded-lg border border-border bg-warning-soft px-4 py-3 text-sm text-warning">
          <p id="aviso-exportadas" className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Há {exportadas} cobrança(s) exportada(s) ainda não marcada(s) como emitidas. Se o arquivo já foi enviado ao
              banco, marque-as como emitidas antes. Regerar vai substituí-las.
            </span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setExportadas(null)}>Voltar</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => enviarRegerar(true)}>
              Regerar mesmo assim
            </Button>
          </div>
        </div>
      )}
      {pendente && <p role="status" className="text-sm text-muted-foreground">Processando…</p>}
      {!pendente && resultado?.erro && <Mensagem tipo="erro">{resultado.erro}</Mensagem>}
      {!pendente && resultado?.mensagem && <Mensagem tipo="ok">{resultado.mensagem}</Mensagem>}
    </div>
  );
}
