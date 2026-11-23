"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatarBRL, parseBRL } from "@/domain/dinheiro";
import { atalhoParcelas, textoParcelaAdicional, validarParcelas, type AtalhoParcelas } from "@/domain/parcelas";
import type { Centavos, ParcelaAdicional } from "@/domain/tipos";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ATALHOS: { id: AtalhoParcelas; rotulo: string }[] = [
  { id: "unica_dezembro", rotulo: "Única em dezembro" },
  { id: "2x_nov_ultimo_dia_dez", rotulo: "2x novembro (último dia) + dezembro" },
  { id: "2x_junto_nov_dez", rotulo: "2x junto das mensalidades de novembro e dezembro" },
];

type Linha = { mes: string; valor: string; forma: ParcelaAdicional["forma"]; dia: string };

function paraLinha(p: ParcelaAdicional): Linha {
  return {
    mes: String(p.mes),
    valor: (p.valor / 100).toFixed(2).replace(".", ","),
    forma: p.forma,
    dia: p.dia === null ? "" : String(p.dia),
  };
}

function paraParcela(l: Linha): ParcelaAdicional {
  return {
    mes: Number(l.mes),
    valor: parseBRL(l.valor),
    forma: l.forma,
    dia: l.forma === "data_propria" && l.dia.trim() !== "" ? Number(l.dia) : null,
  };
}

export function ParcelasAdicionaisEditor({
  inicial, total, diaVencimento, somenteLeitura,
}: {
  inicial: ParcelaAdicional[];
  total: Centavos;
  diaVencimento: number | null;
  somenteLeitura: boolean;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(inicial.map(paraLinha));
  const parcelas = linhas.map(paraParcela);
  const erros = validarParcelas(parcelas, total);
  const texto = parcelas.length && diaVencimento ? textoParcelaAdicional(parcelas, diaVencimento) : "";

  const alterar = (i: number, campos: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...campos } : l)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="parcelas" value={JSON.stringify(parcelas)} />
      {!somenteLeitura && (
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <Button key={a.id} type="button" variant="outline" size="sm" onClick={() => setLinhas(atalhoParcelas(a.id, total).map(paraLinha))}>
              {a.rotulo}
            </Button>
          ))}
        </div>
      )}

      {linhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma parcela adicional cadastrada.</p>}
      <ul className="space-y-2">
        {linhas.map((l, i) => (
          <li key={i} className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Mês</span>
              <select value={l.mes} disabled={somenteLeitura} onChange={(e) => alterar(i, { mes: e.target.value })} className="campo block w-36 text-foreground">
                {MESES.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Valor</span>
              <input value={l.valor} disabled={somenteLeitura} inputMode="decimal" onChange={(e) => alterar(i, { valor: e.target.value })} className="campo block w-32 text-foreground" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Vencimento</span>
              <select value={l.forma} disabled={somenteLeitura} onChange={(e) => alterar(i, { forma: e.target.value as Linha["forma"] })} className="campo block w-56 text-foreground">
                <option value="junto_mensalidade">Junto com a mensalidade</option>
                <option value="data_propria">Data própria</option>
              </select>
            </label>
            {l.forma === "data_propria" && (
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                <span>Dia (vazio = último dia)</span>
                <input value={l.dia} disabled={somenteLeitura} inputMode="numeric" onChange={(e) => alterar(i, { dia: e.target.value })} className="campo block w-24 text-foreground" />
              </label>
            )}
            {!somenteLeitura && (
              <Button type="button" variant="ghost" size="icon" aria-label="Remover parcela" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {!somenteLeitura && (
        <Button type="button" variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, { mes: "12", valor: "", forma: "junto_mensalidade", dia: "" }])}>
          <Plus aria-hidden /> Adicionar parcela
        </Button>
      )}

      <p className="text-sm text-muted-foreground">
        Soma das parcelas: <strong className="tabular-nums">{formatarBRL(parcelas.reduce((s, p) => s + (Number.isFinite(p.valor) ? p.valor : 0), 0))}</strong>
        {" "}de <strong className="tabular-nums">{formatarBRL(total)}</strong>
      </p>
      {erros.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-sm font-medium text-destructive">
          {erros.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {texto && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Texto da cláusula 4.7: </span>{texto}
        </p>
      )}
    </div>
  );
}
