"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ROTULOS_REGIME } from "@/domain/rotulos";
import { salvarCliente, type Resultado } from "./actions";

export type ValoresCliente = Record<string, string>;
type Opcao = { id: string; razao_social: string };

const CAMPOS: { nome: string; rotulo: string; larga?: boolean }[] = [
  { nome: "razao_social", rotulo: "Razão social", larga: true },
  { nome: "nome_fantasia", rotulo: "Nome fantasia" },
  { nome: "documento", rotulo: "CPF/CNPJ" },
  { nome: "codigo_dominio", rotulo: "Código no Domínio" },
  { nome: "logradouro", rotulo: "Logradouro", larga: true },
  { nome: "numero", rotulo: "Número" },
  { nome: "complemento", rotulo: "Complemento" },
  { nome: "bairro", rotulo: "Bairro" },
  { nome: "cidade", rotulo: "Cidade" },
  { nome: "uf", rotulo: "UF" },
  { nome: "cep", rotulo: "CEP" },
  { nome: "telefone", rotulo: "Telefone" },
  { nome: "email", rotulo: "E-mail (de cobrança)" },
  { nome: "inscricao_estadual", rotulo: "Inscrição estadual" },
  { nome: "inscricao_municipal", rotulo: "Inscrição municipal" },
];

type Props = { id?: string; valores: ValoresCliente; suspeitos: string[]; opcoesIndicacao: Opcao[]; somenteLeitura: boolean };

export function FormularioCliente({ id, valores, suspeitos, opcoesIndicacao, somenteLeitura }: Props) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarCliente, {});
  const campoSuspeito = (n: string) => suspeitos.includes(n);
  const classe = (n: string) =>
    `block w-full rounded border px-3 py-2 ${campoSuspeito(n) ? "border-yellow-500 bg-yellow-100 text-foreground" : ""}`;
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="id" value={id ?? ""} />
      <fieldset disabled={somenteLeitura} className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <label key={c.nome} className={`space-y-1 text-sm ${c.larga ? "sm:col-span-2" : ""}`}>
            <span>{c.rotulo}{campoSuspeito(c.nome) && " (conferir)"}</span>
            <input name={c.nome} defaultValue={valores[c.nome] ?? ""} required={c.nome === "razao_social"} className={classe(c.nome)} />
          </label>
        ))}
        <label className="space-y-1 text-sm">
          <span>Regime tributário</span>
          <select name="regime" defaultValue={valores.regime ?? ""} className={classe("regime")}>
            <option value="">Não informado</option>
            {Object.entries(ROTULOS_REGIME).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Indicado por</span>
          <select name="indicado_por" defaultValue={valores.indicado_por ?? ""} className="block w-full rounded border px-3 py-2">
            <option value="">Ninguém</option>
            {opcoesIndicacao.map((o) => <option key={o.id} value={o.id}>{o.razao_social}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Observações</span>
          <textarea name="observacoes" rows={3} defaultValue={valores.observacoes ?? ""} className="block w-full rounded border px-3 py-2" />
        </label>
      </fieldset>
      {!somenteLeitura && <Button type="submit" disabled={pendente}>{id ? "Salvar cliente" : "Criar cliente"}</Button>}
      {estado.erro && <p role="alert" className="text-sm text-destructive">{estado.erro}</p>}
      {estado.ok && <p role="status" className="text-sm text-muted-foreground">Salvo.</p>}
    </form>
  );
}
