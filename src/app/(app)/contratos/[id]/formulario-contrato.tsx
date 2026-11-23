"use client";

import { useActionState, useState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { parseBRL } from "@/domain/dinheiro";
import { ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import type { ParcelaAdicional } from "@/domain/tipos";
import { salvarContrato, type Resultado } from "../actions";
import { ParcelasAdicionaisEditor } from "./ParcelasAdicionaisEditor";

export type ValoresContrato = {
  id: string; situacao: string; honorario: string; dia_vencimento: string; data_inicio: string;
  carteira_id: string; tipo_cobranca: string; email_cobranca: string; parcela_adicional_total: string;
  legado: boolean; encerrado_em: string; parcelas: ParcelaAdicional[];
};

const SITUACOES = [
  { v: "em_negociacao", r: "Em negociação" },
  { v: "fechado", r: "Fechado" },
  { v: "encerrado", r: "Encerrado" },
];

export function FormularioContrato({
  valores, carteiras, somenteLeitura,
}: {
  valores: ValoresContrato;
  carteiras: { id: string; nome: string }[];
  somenteLeitura: boolean;
}) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarContrato, {});
  const [situacao, setSituacao] = useState(valores.situacao);
  const [total, setTotal] = useState(valores.parcela_adicional_total);
  const [dia, setDia] = useState(valores.dia_vencimento);
  const rotulo = "space-y-1.5 text-sm font-medium";
  const campo = "campo w-full font-normal";

  return (
    <form action={acao} className="space-y-6">
      <input type="hidden" name="id" value={valores.id} />
      <fieldset disabled={somenteLeitura} className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <label className={rotulo}>
          <span>Situação</span>
          <select name="situacao" value={situacao} onChange={(e) => setSituacao(e.target.value)} className={campo}>
            {SITUACOES.map((s) => <option key={s.v} value={s.v}>{s.r}</option>)}
          </select>
        </label>
        {situacao === "encerrado" && (
          <label className={rotulo}>
            <span>Data de encerramento</span>
            <input type="date" name="encerrado_em" defaultValue={valores.encerrado_em} required className={campo} />
          </label>
        )}
        <label className={rotulo}>
          <span>Honorário mensal</span>
          <input name="honorario" inputMode="decimal" defaultValue={valores.honorario} placeholder="0,00" className={campo} />
        </label>
        <label className={rotulo}>
          <span>Dia de vencimento</span>
          <input name="dia_vencimento" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
        </label>
        <label className={rotulo}>
          <span>Data de início</span>
          <input type="date" name="data_inicio" defaultValue={valores.data_inicio} className={campo} />
        </label>
        <label className={rotulo}>
          <span>Carteira</span>
          <select name="carteira_id" defaultValue={valores.carteira_id} className={campo}>
            <option value="">Não informada</option>
            {carteiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className={rotulo}>
          <span>Tipo de cobrança</span>
          <select name="tipo_cobranca" defaultValue={valores.tipo_cobranca} className={campo}>
            <option value="">Não informado</option>
            {Object.entries(ROTULOS_TIPO_COBRANCA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className={rotulo}>
          <span>E-mail de cobrança</span>
          <input type="email" name="email_cobranca" defaultValue={valores.email_cobranca} className={campo} />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" name="legado" defaultChecked={valores.legado} />
          Contrato anterior (sem documento no CRM)
        </label>

        <div className="space-y-3 border-t pt-4 sm:col-span-2">
          <h3 className="font-heading text-base font-bold text-heading">Parcela adicional (cláusula 4.7)</h3>
          <label className={`${rotulo} block max-w-xs`}>
            <span>Valor total da parcela adicional</span>
            <input name="parcela_adicional_total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" className={campo} />
          </label>
          <ParcelasAdicionaisEditor
            inicial={valores.parcelas}
            total={parseBRL(total)}
            diaVencimento={Number(dia) || null}
            somenteLeitura={somenteLeitura}
          />
        </div>

        <label className={`${rotulo} sm:col-span-2`}>
          <span>Motivo da alteração de valores (opcional)</span>
          <input name="motivo" placeholder="Ex.: reajuste anual" className={campo} />
        </label>
      </fieldset>
      {!somenteLeitura && <Button type="submit" disabled={pendente}>Salvar contrato</Button>}
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.ok && <Mensagem tipo="ok">Salvo.</Mensagem>}
    </form>
  );
}
