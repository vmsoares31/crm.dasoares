"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ROTULOS_REGIME, ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import { salvarEdicaoEmMassa, type ResultadoMassa } from "./actions";

type Campos = {
  regime: string; honorario: string; dia_vencimento: string;
  carteira_id: string; tipo_cobranca: string; email_cobranca: string;
};
export type LinhaMassaVista = { clienteId: string; nome: string; pendencias: number; valores: Campos };

const CHAVES: (keyof Campos)[] = ["regime", "honorario", "dia_vencimento", "carteira_id", "tipo_cobranca", "email_cobranca"];
const campo = "w-full rounded border px-2 py-1";

export function TabelaMassa({ linhas, carteiras }: { linhas: LinhaMassaVista[]; carteiras: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Record<string, Campos>>({});
  const [resultado, setResultado] = useState<ResultadoMassa | null>(null);
  const [pendente, iniciar] = useTransition();

  const atual = (l: LinhaMassaVista) => edit[l.clienteId] ?? l.valores;
  const alterada = (l: LinhaMassaVista) => CHAVES.some((k) => atual(l)[k].trim() !== l.valores[k].trim());
  const alteradas = linhas.filter(alterada);
  const erroDe = (id: string) => resultado?.erros?.find((e) => e.clienteId === id)?.mensagem;

  function mudar(l: LinhaMassaVista, k: keyof Campos, v: string) {
    setEdit((e) => ({ ...e, [l.clienteId]: { ...(e[l.clienteId] ?? l.valores), [k]: v } }));
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarEdicaoEmMassa(alteradas.map((l) => ({ clienteId: l.clienteId, ...atual(l) })));
      setResultado(r);
      // Mantém só as linhas com erro em edição; as salvas voltam a refletir o servidor.
      const comErro = new Set((r.erros ?? []).map((e) => e.clienteId));
      setEdit((e) => Object.fromEntries(Object.entries(e).filter(([id]) => comErro.has(id))));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Button type="button" onClick={salvar} disabled={pendente || alteradas.length === 0}>
          Salvar {alteradas.length > 0 ? `${alteradas.length} linha(s)` : "alterações"}
        </Button>
        {resultado?.erro && <p role="alert" className="text-sm text-destructive">{resultado.erro}</p>}
        {resultado && !resultado.erro && (
          <p role="status" className="text-sm text-muted-foreground">
            {resultado.salvos} linha(s) salva(s){resultado.erros?.length ? `, ${resultado.erros.length} com erro` : ""}.
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-2">Cliente</th><th className="pr-2">Regime</th><th className="pr-2">Honorário</th>
              <th className="pr-2">Dia</th><th className="pr-2">Carteira</th><th className="pr-2">Cobrança</th>
              <th className="pr-2">E-mail de cobrança</th><th>Pend.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const v = atual(l);
              const erro = erroDe(l.clienteId);
              return (
                <tr key={l.clienteId} className={`border-b align-top ${alterada(l) ? "bg-muted" : ""}`}>
                  <td className="py-2 pr-2">{l.nome}{erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}</td>
                  <td className="pr-2">
                    <select aria-label={`Regime de ${l.nome}`} value={v.regime} onChange={(e) => mudar(l, "regime", e.target.value)} className={campo}>
                      <option value="">—</option>
                      {Object.entries(ROTULOS_REGIME).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <input aria-label={`Honorário de ${l.nome}`} value={v.honorario} placeholder="R$ 0,00" onChange={(e) => mudar(l, "honorario", e.target.value)} className={`${campo} w-28`} />
                  </td>
                  <td className="pr-2">
                    <input aria-label={`Dia de vencimento de ${l.nome}`} value={v.dia_vencimento} inputMode="numeric" onChange={(e) => mudar(l, "dia_vencimento", e.target.value)} className={`${campo} w-14`} />
                  </td>
                  <td className="pr-2">
                    <select aria-label={`Carteira de ${l.nome}`} value={v.carteira_id} onChange={(e) => mudar(l, "carteira_id", e.target.value)} className={campo}>
                      <option value="">—</option>
                      {carteiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <select aria-label={`Tipo de cobrança de ${l.nome}`} value={v.tipo_cobranca} onChange={(e) => mudar(l, "tipo_cobranca", e.target.value)} className={campo}>
                      <option value="">—</option>
                      {Object.entries(ROTULOS_TIPO_COBRANCA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <input aria-label={`E-mail de cobrança de ${l.nome}`} value={v.email_cobranca} onChange={(e) => mudar(l, "email_cobranca", e.target.value)} className={campo} />
                  </td>
                  <td>{l.pendencias}</td>
                </tr>
              );
            })}
            {linhas.length === 0 && <tr><td colSpan={8} className="py-4 text-muted-foreground">Nenhum cliente ativo ou a revisar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
