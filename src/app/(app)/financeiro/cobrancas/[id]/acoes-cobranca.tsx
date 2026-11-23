"use client";

import { useState, useTransition } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AcoesCobranca as Acoes } from "@/domain/baixa";
import { formatarBRL } from "@/domain/dinheiro";
import { cancelar, darBaixa, dispensar, type ResultadoAcaoCobranca } from "./actions";

type Modo = "baixa" | "cancelar" | "dispensar" | null;

export function AcoesCobranca({ id, acoes, saldo, hoje, temCreditoUsado }: {
  id: string; acoes: Acoes; saldo: number; hoje: string; temCreditoUsado: boolean;
}) {
  const [modo, setModo] = useState<Modo>(null);
  const [retorno, setRetorno] = useState<ResultadoAcaoCobranca | null>(null);
  const [pendente, iniciar] = useTransition();

  function executar(acao: () => Promise<ResultadoAcaoCobranca>) {
    setRetorno(null);
    iniciar(async () => {
      const r = await acao();
      setRetorno(r);
      if (r.ok) setModo(null);
    });
  }

  return (
    <Card size="sm" className="gap-3 px-5">
      <div className="flex flex-wrap gap-2">
        {acoes.baixa && (
          <Button type="button" size="sm" variant={modo === "baixa" ? "default" : "outline"} onClick={() => setModo("baixa")}>Dar baixa</Button>
        )}
        {acoes.dispensar && (
          <Button type="button" size="sm" variant={modo === "dispensar" ? "default" : "outline"} onClick={() => setModo("dispensar")}>Dispensar saldo</Button>
        )}
        {acoes.cancelar && (
          <Button type="button" size="sm" variant="destructive" onClick={() => setModo("cancelar")}>Cancelar cobrança</Button>
        )}
      </div>

      {modo === "baixa" && (
        <FormBaixa
          saldo={saldo}
          hoje={hoje}
          pendente={pendente}
          aoVoltar={() => setModo(null)}
          aoEnviar={(d, v) => executar(() => darBaixa(id, d, v))}
        />
      )}
      {modo === "cancelar" && (
        <FormMotivo
          rotulo="Motivo do cancelamento"
          botao="Confirmar cancelamento"
          destrutivo
          aviso={`A cobrança fica cancelada; extras vinculados voltam a pendentes${temCreditoUsado ? " e o crédito de indicação usado volta ao saldo do cliente" : ""}. Se ela já foi emitida no banco, cancele lá também. Para reemitir, use “Regerar previstas” (ou “Abrir mês”) no fechamento da competência: uma cobrança substituta é gerada.`}
          pendente={pendente}
          aoVoltar={() => setModo(null)}
          aoEnviar={(m) => executar(() => cancelar(id, m))}
        />
      )}
      {modo === "dispensar" && (
        <FormMotivo
          rotulo="Motivo da dispensa"
          botao="Dispensar saldo"
          aviso={`O saldo de ${formatarBRL(saldo)} deixa de ser cobrado e a cobrança sai da inadimplência.`}
          pendente={pendente}
          aoVoltar={() => setModo(null)}
          aoEnviar={(m) => executar(() => dispensar(id, m))}
        />
      )}

      {retorno?.erro && <Mensagem tipo="erro">{retorno.erro}</Mensagem>}
      {retorno?.mensagem && <Mensagem tipo="ok">{retorno.mensagem}</Mensagem>}
    </Card>
  );
}

function FormBaixa({ saldo, hoje, pendente, aoVoltar, aoEnviar }: {
  saldo: number; hoje: string; pendente: boolean; aoVoltar: () => void; aoEnviar: (data: string, valor: string) => void;
}) {
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(formatarBRL(saldo).replace("R$ ", ""));
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar(data, valor);
      }}
    >
      <label className="space-y-1.5 text-sm font-medium"><span>Data do pagamento</span>
        <input type="date" required max={hoje} value={data} onChange={(e) => setData(e.target.value)} className="campo font-normal" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Valor recebido (R$)</span>
        <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="campo w-36 font-normal tabular-nums" /></label>
      <Button type="submit" size="sm" disabled={pendente}>Registrar baixa</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={aoVoltar}>Voltar</Button>
      <p className="w-full text-xs text-muted-foreground">
        Valor menor que o saldo deixa a cobrança paga parcialmente; valor maior fica registrado como acréscimo (multa/juros).
      </p>
    </form>
  );
}

function FormMotivo({ rotulo, botao, aviso, destrutivo, pendente, aoVoltar, aoEnviar }: {
  rotulo: string; botao: string; aviso: string; destrutivo?: boolean; pendente: boolean;
  aoVoltar: () => void; aoEnviar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar(motivo);
      }}
    >
      <label className="space-y-1.5 text-sm font-medium"><span>{rotulo}</span>
        <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo w-80 max-w-full font-normal" /></label>
      <Button type="submit" size="sm" variant={destrutivo ? "destructive" : "default"} disabled={pendente}>{botao}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={aoVoltar}>Voltar</Button>
      <p className="w-full text-xs text-muted-foreground">{aviso}</p>
    </form>
  );
}
