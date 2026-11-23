"use client";

import { useMemo, useState, useTransition } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatarBRL, parseBRL } from "@/domain/dinheiro";
import { parsePercentual, previaReajusteContratos, reajustarTabelaExtras, type ContratoParaReajuste } from "@/domain/reajuste";
import { aplicarReajusteContratos, aplicarReajusteExtras, type ResultadoReajuste } from "./actions";

type Contrato = ContratoParaReajuste & { razaoSocial: string; legado: boolean };
type Servico = { id: string; nome: string; valor: number; ativo: boolean };

export function PainelReajuste({ contratos, servicos }: { contratos: Contrato[]; servicos: Servico[] }) {
  const [aba, setAba] = useState<"contratos" | "extras">("contratos");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Tipo de reajuste" className="flex gap-2">
        {(["contratos", "extras"] as const).map((a) => (
          <Button key={a} role="tab" aria-selected={aba === a} variant={aba === a ? "default" : "outline"} onClick={() => setAba(a)}>
            {a === "contratos" ? "Honorários e parcela adicional" : "Serviços extras"}
          </Button>
        ))}
      </div>
      {aba === "contratos" ? <AbaContratos contratos={contratos} /> : <AbaExtras servicos={servicos} />}
    </div>
  );
}

function Resultado({ r }: { r: ResultadoReajuste | null }) {
  if (!r) return null;
  if (r.erro) return <Mensagem tipo="erro">{r.erro}</Mensagem>;
  return (
    <div className="space-y-1">
      <Mensagem tipo="ok">{r.aplicados} reajuste(s) aplicado(s).</Mensagem>
      {r.falhas && r.falhas.length > 0 && (
        <div role="alert" className="text-sm text-destructive">
          <p className="font-medium">Não foi possível reajustar {r.falhas.length}:</p>
          <ul className="list-disc pl-5">{r.falhas.map((f) => <li key={f.id}>{f.nome}: {f.erro}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function AbaContratos({ contratos }: { contratos: Contrato[] }) {
  const [pctTexto, setPctTexto] = useState("");
  const [editados, setEditados] = useState<Record<string, { h?: string; p?: string }>>({});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ResultadoReajuste | null>(null);
  const [pendente, iniciar] = useTransition();
  const pct = parsePercentual(pctTexto);
  const previa = useMemo(() => (pct === null ? [] : previaReajusteContratos(contratos, pct)), [contratos, pct]);
  const nomes = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);

  const valorFinal = (id: string, campo: "h" | "p", calculado: number) => {
    const e = editados[id]?.[campo];
    return e === undefined ? calculado : parseBRL(e);
  };
  const alternar = (id: string) =>
    setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function aplicar(ids: string[]) {
    if (pct === null || ids.length === 0) return;
    if (!window.confirm(`Aplicar o reajuste de ${pctTexto}% a ${ids.length} contrato(s)? Esta ação grava o histórico de valores.`)) return;
    const itens = previa.filter((r) => ids.includes(r.contratoId)).map((r) => ({
      contratoId: r.contratoId,
      honorarioPara: valorFinal(r.contratoId, "h", r.honorarioPara),
      parcelaPara: valorFinal(r.contratoId, "p", r.parcelaPara),
    }));
    iniciar(async () => {
      const r = await aplicarReajusteContratos(pctTexto, itens);
      setResultado(r);
      if (!r.erro) { setSelecionados(new Set()); setEditados({}); }
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium"><span>Percentual de reajuste (%)</span>
          <input value={pctTexto} onChange={(e) => { setPctTexto(e.target.value); setEditados({}); }} inputMode="decimal" placeholder="4,75" className="campo w-32 font-normal tabular-nums" /></label>
        <Button disabled={pendente || previa.length === 0 || selecionados.size === 0} onClick={() => aplicar([...selecionados])}>
          Aplicar aos selecionados ({selecionados.size})
        </Button>
        <Button variant="outline" disabled={pendente || previa.length === 0} onClick={() => aplicar(previa.map((r) => r.contratoId))}>
          Aplicar a todos ({previa.length})
        </Button>
      </div>
      {pctTexto !== "" && pct === null && <Mensagem tipo="erro">Percentual inválido (use um valor entre 0 e 100).</Mensagem>}
      <Resultado r={resultado} />
      {previa.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2"><input type="checkbox" aria-label="Selecionar todos"
                  checked={selecionados.size === previa.length}
                  onChange={(e) => setSelecionados(e.target.checked ? new Set(previa.map((r) => r.contratoId)) : new Set())} /></th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3 text-right">Honorário atual</th>
                <th className="py-2 pr-3">Novo honorário</th>
                <th className="py-2 pr-3 text-right">Parcela adicional atual</th>
                <th className="py-2">Nova parcela adicional</th>
              </tr>
            </thead>
            <tbody>
              {previa.map((r) => {
                const c = nomes.get(r.contratoId);
                return (
                  <tr key={r.contratoId} className="border-b last:border-0">
                    <td className="py-2 pr-2"><input type="checkbox" aria-label={`Selecionar ${c?.razaoSocial}`} checked={selecionados.has(r.contratoId)} onChange={() => alternar(r.contratoId)} /></td>
                    <td className="py-2 pr-3">{c?.razaoSocial}{c?.legado && <span className="ml-2 text-xs text-muted-foreground">legado</span>}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatarBRL(r.honorarioDe)}</td>
                    <td className="py-2 pr-3">
                      <input aria-label={`Novo honorário de ${c?.razaoSocial}`} className="campo campo-compacto w-28 tabular-nums"
                        value={editados[r.contratoId]?.h ?? formatarBRL(r.honorarioPara)}
                        onChange={(e) => setEditados((s) => ({ ...s, [r.contratoId]: { ...s[r.contratoId], h: e.target.value } }))} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.parcelaDe ? formatarBRL(r.parcelaDe) : "—"}</td>
                    <td className="py-2">
                      {r.parcelaDe ? (
                        <input aria-label={`Nova parcela adicional de ${c?.razaoSocial}`} className="campo campo-compacto w-28 tabular-nums"
                          value={editados[r.contratoId]?.p ?? formatarBRL(r.parcelaPara)}
                          onChange={(e) => setEditados((s) => ({ ...s, [r.contratoId]: { ...s[r.contratoId], p: e.target.value } }))} />
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pct !== null && previa.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato com honorário definido.</p>}
    </Card>
  );
}

function AbaExtras({ servicos }: { servicos: Servico[] }) {
  const [pctTexto, setPctTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoReajuste | null>(null);
  const [pendente, iniciar] = useTransition();
  const pct = parsePercentual(pctTexto);
  const previa = useMemo(() => (pct === null ? [] : reajustarTabelaExtras(servicos, pct)), [servicos, pct]);
  const nomes = new Map(servicos.map((s) => [s.id, s]));

  return (
    <Card className="space-y-4 p-5">
      <p className="text-sm text-muted-foreground">Percentual único para todos os serviços, arredondado para cima ao real inteiro.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm font-medium"><span>Percentual de reajuste (%)</span>
          <input value={pctTexto} onChange={(e) => setPctTexto(e.target.value)} inputMode="decimal" placeholder="4,75" className="campo w-32 font-normal tabular-nums" /></label>
        <Button disabled={pendente || previa.length === 0} onClick={() => {
          if (!window.confirm(`Aplicar ${pctTexto}% a ${previa.length} serviço(s) extra(s)?`)) return;
          iniciar(async () => setResultado(await aplicarReajusteExtras(pctTexto)));
        }}>Aplicar à tabela</Button>
      </div>
      {pctTexto !== "" && pct === null && <Mensagem tipo="erro">Percentual inválido (use um valor entre 0 e 100).</Mensagem>}
      <Resultado r={resultado} />
      {previa.length > 0 && (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Serviço</th><th className="py-2 text-right">Atual</th><th className="py-2 text-right">Novo</th></tr></thead>
          <tbody>
            {previa.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-2">{nomes.get(r.id)?.nome}{!nomes.get(r.id)?.ativo && <span className="ml-2 text-xs text-muted-foreground">inativo</span>}</td>
                <td className="py-2 text-right tabular-nums">{formatarBRL(r.de)}</td>
                <td className="py-2 text-right tabular-nums">{formatarBRL(r.para)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
