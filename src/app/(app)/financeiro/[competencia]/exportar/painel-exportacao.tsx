"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

import { Mensagem } from "@/components/mensagem";
import { Selo } from "@/components/situacao-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatarData } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { formatarDocumento } from "@/domain/documentos";
import { ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import type { TipoCobranca } from "@/domain/tipos";
import { aplicarNovaData, marcarComoEmitidas, type ResultadoExportacao } from "./actions";

export type LinhaExportacao = {
  id: string; cliente: string; documento: string; valor: number; vencimento: string; descricao: string;
  tipo: TipoCobranca | null; carteira: string; vencida: boolean;
};

type Aviso = { tipo: "erro" | "ok"; texto: string; detalhes?: string[] };
type ErroArquivo = { cliente: string; erro: string };

export function PainelExportacao({ competencia, linhas, vencimentoSugerido }: { competencia: string; linhas: LinhaExportacao[]; vencimentoSugerido: string }) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [novaData, setNovaData] = useState(vencimentoSugerido);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pendente, iniciar] = useTransition();
  const ids = linhas.filter((l) => selecionadas.has(l.id)).map((l) => l.id);
  const vencidas = linhas.filter((l) => l.vencida);
  const todasMarcadas = linhas.length > 0 && ids.length === linhas.length;

  function alternar(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  function resultado(r: ResultadoExportacao) {
    setAviso(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: r.mensagem ?? "Concluído." });
  }

  function baixar(formato: "cora" | "excel") {
    setAviso(null);
    iniciar(async () => {
      const corpo = new FormData();
      corpo.set("formato", formato);
      for (const id of ids) corpo.append("ids", id);
      try {
        const resp = await fetch(`/financeiro/${competencia}/exportar/arquivo`, { method: "POST", body: corpo });
        if (!resp.ok) {
          const j = (await resp.json().catch(() => ({}))) as { erro?: string; erros?: ErroArquivo[] };
          setAviso({ tipo: "erro", texto: j.erro ?? "Não foi possível gerar o arquivo.", detalhes: j.erros?.map((e) => `${e.cliente}: ${e.erro}`) });
          return;
        }
        const blob = await resp.blob();
        const nome = /filename="([^"]+)"/.exec(resp.headers.get("Content-Disposition") ?? "")?.[1] ?? `exportacao-${competencia}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        const total = Number(resp.headers.get("X-Erros-Total") ?? "0");
        const erros = JSON.parse(decodeURIComponent(resp.headers.get("X-Erros") ?? "[]")) as ErroArquivo[];
        setAviso({
          tipo: total > 0 ? "erro" : "ok",
          texto: `${resp.headers.get("X-Exportadas")} cobrança(s) no arquivo` + (total > 0 ? ` · ${total} ficaram de fora:` : "."),
          detalhes: erros.map((e) => `${e.cliente}: ${e.erro}`),
        });
      } catch {
        setAviso({ tipo: "erro", texto: "Falha de conexão ao gerar o arquivo." });
      }
    });
  }

  function aplicar(alvo: string[]) {
    setAviso(null);
    iniciar(async () => resultado(await aplicarNovaData(competencia, alvo, novaData)));
  }

  function marcar(alvo: string[] | "ultimo") {
    const pergunta = alvo === "ultimo"
      ? "Marcar como emitidas todas as cobranças do último arquivo baixado?"
      : `Marcar ${alvo.length} cobrança(s) como emitida(s)?`;
    if (!window.confirm(pergunta)) return;
    setAviso(null);
    iniciar(async () => resultado(await marcarComoEmitidas(competencia, alvo)));
  }

  return (
    <div className="space-y-4">
      <Card size="sm" className="gap-3 px-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={pendente || ids.length === 0} onClick={() => baixar("cora")}>
            <Download aria-hidden /> Baixar CSV Cora
          </Button>
          <Button type="button" variant="outline" disabled={pendente || ids.length === 0} onClick={() => baixar("excel")}>
            <FileSpreadsheet aria-hidden /> Lista manual (Excel)
          </Button>
          <Button type="button" variant="outline" disabled={ids.length === 0} onClick={() => window.print()}>
            <Printer aria-hidden /> Imprimir lista
          </Button>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <Button type="button" variant="outline" disabled={pendente || ids.length === 0} onClick={() => marcar(ids)}>
            Marcar selecionadas como emitidas
          </Button>
          <Button type="button" variant="outline" disabled={pendente} onClick={() => marcar("ultimo")}>
            Marcar todas do último arquivo
          </Button>
        </div>
        {vencidas.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            <span className="self-center">{vencidas.length} cobrança(s) com vencimento no passado (o Cora recusa).</span>
            <label className="space-y-1 font-medium"><span>Nova data</span>
              <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="campo campo-compacto font-normal text-foreground" /></label>
            <Button type="button" variant="outline" disabled={pendente || !novaData || ids.length === 0} onClick={() => aplicar(ids)}>Aplicar às selecionadas</Button>
            <Button type="button" variant="outline" disabled={pendente || !novaData} onClick={() => aplicar(vencidas.map((v) => v.id))}>Aplicar a todas as vencidas</Button>
          </div>
        )}
        {pendente && <p role="status" className="text-sm text-muted-foreground">Processando…</p>}
        {!pendente && aviso && (
          <div>
            <Mensagem tipo={aviso.tipo}>{aviso.texto}</Mensagem>
            {aviso.detalhes && aviso.detalhes.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{aviso.detalhes.map((d) => <li key={d}>{d}</li>)}</ul>
            )}
          </div>
        )}
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th className="w-8 print:hidden">
                  <input type="checkbox" aria-label="Selecionar todas" checked={todasMarcadas}
                    onChange={() => setSelecionadas(todasMarcadas ? new Set() : new Set(linhas.map((l) => l.id)))} />
                </th>
                <th>Cliente</th><th>CPF/CNPJ</th><th>Carteira</th><th>Tipo</th><th>Vencimento</th><th>Valor</th>
                <th className="print:hidden">Descrição</th>
                <th className="hidden print:table-cell">Emitida</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground">Nenhuma cobrança prevista com estes filtros.</td></tr>}
              {linhas.map((l) => (
                <tr key={l.id} className={selecionadas.has(l.id) ? "" : "print:hidden"}>
                  <td className="print:hidden"><input type="checkbox" aria-label={`Selecionar ${l.cliente}`} checked={selecionadas.has(l.id)} onChange={() => alternar(l.id)} /></td>
                  <td className="font-medium">{l.cliente}</td>
                  <td className="tabular-nums">{formatarDocumento(l.documento)}</td>
                  <td>{l.carteira}</td>
                  <td>{l.tipo ? ROTULOS_TIPO_COBRANCA[l.tipo] : "—"}</td>
                  <td className="whitespace-nowrap">
                    {formatarData(l.vencimento)} {l.vencida && <Selo tom="alerta" className="print:hidden">Vencida</Selo>}
                  </td>
                  <td className="tabular-nums">{formatarBRL(l.valor)}</td>
                  <td className="print:hidden">{l.descricao}</td>
                  <td className="hidden print:table-cell">[&nbsp;&nbsp;&nbsp;]</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
