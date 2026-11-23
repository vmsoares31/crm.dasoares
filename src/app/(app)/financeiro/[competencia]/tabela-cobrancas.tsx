"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Mensagem } from "@/components/mensagem";
import { Selo, type TomSelo } from "@/components/situacao-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatarData } from "@/domain/datas";
import { formatarBRL, parseBRL } from "@/domain/dinheiro";
import { excluirDoMes, salvarItens, type ItemEditado } from "./actions";

export type ItemTabela = { tipo: string; descricao: string; valor: number; refId: string | null };
export type CobrancaTabela = {
  id: string; clienteNome: string; origem: string; vencimento: string; total: number; situacao: string;
  atrasada: boolean; motivoCancelamento: string | null; descricao: string; itens: ItemTabela[];
};

const SITUACOES: Record<string, { rotulo: string; tom: TomSelo }> = {
  prevista: { rotulo: "Prevista", tom: "neutro" },
  emitida: { rotulo: "Emitida", tom: "info" },
  paga: { rotulo: "Paga", tom: "sucesso" },
  paga_parcial: { rotulo: "Paga parcialmente", tom: "alerta" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
  quitada_por_credito: { rotulo: "Quitada por crédito", tom: "sucesso" },
};
const TIPOS_ITEM: Record<string, string> = {
  mensalidade: "Mensalidade",
  extra: "Extra",
  parcela_adicional: "Parcela adicional",
  desconto_indicacao: "Desconto indicação",
};

export function TabelaCobrancas({ competencia, cobrancas, podeOperar }: { competencia: string; cobrancas: CobrancaTabela[]; podeOperar: boolean }) {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <Card className="py-0">
      <div className="overflow-x-auto">
        <table className="tabela">
          <thead>
            <tr><th className="w-8" /><th>Cliente</th><th>Origem</th><th>Vencimento</th><th>Total</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {cobrancas.map((c) => {
              const s = c.atrasada ? { rotulo: "Atrasada", tom: "perigo" as TomSelo } : (SITUACOES[c.situacao] ?? { rotulo: c.situacao, tom: "neutro" as TomSelo });
              const expandida = aberta === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className={c.situacao === "cancelada" ? "text-muted-foreground" : undefined}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setAberta(expandida ? null : c.id)}
                        aria-expanded={expandida}
                        aria-label={expandida ? "Recolher itens" : "Ver itens"}
                        className="grid size-7 place-items-center rounded-md hover:bg-muted"
                      >
                        {expandida ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                      </button>
                    </td>
                    <td className="max-w-80"><span className="block truncate font-medium">{c.clienteNome}</span></td>
                    <td className="whitespace-nowrap">{c.origem === "mensal" ? "Mensal" : "Parcela avulsa"}</td>
                    <td className="whitespace-nowrap">{formatarData(c.vencimento)}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatarBRL(c.total)}</td>
                    <td className="whitespace-nowrap"><Selo tom={s.tom}>{s.rotulo}</Selo></td>
                  </tr>
                  {expandida && (
                    <tr className="hover:bg-transparent!">
                      <td />
                      <td colSpan={5} className="bg-muted/40">
                        <DetalheCobranca competencia={competencia} cobranca={c} podeOperar={podeOperar} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {cobrancas.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Mês ainda não aberto: nenhuma cobrança nesta competência.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DetalheCobranca({ competencia, cobranca: c, podeOperar }: { competencia: string; cobranca: CobrancaTabela; podeOperar: boolean }) {
  const [modo, setModo] = useState<"ver" | "editar" | "excluir">("ver");
  const editavel = podeOperar && c.situacao === "prevista";

  if (modo === "editar") return <EditorItens competencia={competencia} cobranca={c} aoFechar={() => setModo("ver")} />;

  return (
    <div className="space-y-3 py-2">
      <ul className="space-y-1 text-sm">
        {c.itens.map((i, n) => (
          <li key={n} className="flex max-w-xl justify-between gap-4">
            <span><span className="text-muted-foreground">{TIPOS_ITEM[i.tipo] ?? i.tipo} · </span>{i.descricao}</span>
            <span className="tabular-nums">{formatarBRL(i.valor)}</span>
          </li>
        ))}
      </ul>
      {c.descricao && <p className="text-xs text-muted-foreground">Descrição: {c.descricao}</p>}
      {c.motivoCancelamento && <p className="text-xs text-muted-foreground">Motivo do cancelamento: {c.motivoCancelamento}</p>}
      {editavel && modo === "ver" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setModo("editar")}>Editar itens</Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => setModo("excluir")}>Excluir do mês</Button>
        </div>
      )}
      {editavel && modo === "excluir" && <ExcluirDoMes competencia={competencia} id={c.id} aoFechar={() => setModo("ver")} />}
    </div>
  );
}

type Linha = ItemEditado & { chave: number };

function EditorItens({ competencia, cobranca: c, aoFechar }: { competencia: string; cobranca: CobrancaTabela; aoFechar: () => void }) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    c.itens.map((i, n) => ({ chave: n, tipo: i.tipo, descricao: i.descricao, valor: formatarBRL(i.valor), refId: i.refId })),
  );
  const [seq, setSeq] = useState(c.itens.length);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const total = linhas.reduce((s, l) => s + parseBRL(l.valor), 0);
  const alterar = (chave: number, campo: "descricao" | "valor", v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarItens(competencia, c.id, linhas.map(({ tipo, descricao, valor, refId }) => ({ tipo, descricao, valor, refId })));
      if (r.erro) setErro(r.erro);
      else aoFechar();
    });
  }

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-2">
        {linhas.map((l) => {
          const desconto = l.tipo === "desconto_indicacao";
          return (
            <div key={l.chave} className="flex flex-wrap items-center gap-2">
              <span className="w-36 text-xs text-muted-foreground">{TIPOS_ITEM[l.tipo] ?? l.tipo}{l.refId ? " (vinculado)" : ""}</span>
              <input
                aria-label="Descrição do item"
                value={l.descricao}
                disabled={desconto}
                onChange={(e) => alterar(l.chave, "descricao", e.target.value)}
                className="campo min-w-48 flex-1 font-normal"
              />
              <input
                aria-label="Valor do item"
                value={l.valor}
                disabled={desconto}
                inputMode="decimal"
                onChange={(e) => alterar(l.chave, "valor", e.target.value)}
                className="campo w-32 font-normal tabular-nums"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={desconto}
                title={desconto ? "O desconto de indicação não pode ser removido aqui" : "Remover item"}
                aria-label="Remover item"
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setLinhas((ls) => [...ls, { chave: seq, tipo: "extra", descricao: "", valor: "", refId: null }]);
            setSeq((n) => n + 1);
          }}
        >
          <Plus aria-hidden />
          Adicionar item
        </Button>
        <span className="text-sm">Total: <span className="font-semibold tabular-nums text-heading">{formatarBRL(total)}</span></span>
      </div>
      <p className="text-xs text-muted-foreground">Extras vinculados removidos daqui voltam a ficar pendentes.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={pendente} onClick={salvar}>Salvar itens</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={aoFechar}>Cancelar</Button>
        {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      </div>
    </div>
  );
}

function ExcluirDoMes({ competencia, id, aoFechar }: { competencia: string; id: string; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await excluirDoMes(competencia, id, motivo);
          if (r.erro) setErro(r.erro);
          else aoFechar();
        });
      }}
    >
      <label className="space-y-1.5 text-sm font-medium"><span>Motivo da exclusão do mês</span>
        <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo w-72 max-w-full font-normal" /></label>
      <Button type="submit" size="sm" variant="destructive" disabled={pendente}>Confirmar exclusão</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pendente} onClick={aoFechar}>Voltar</Button>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <p className="w-full text-xs text-muted-foreground">A cobrança fica cancelada; extras voltam a pendentes e o crédito de indicação usado volta ao saldo.</p>
    </form>
  );
}
