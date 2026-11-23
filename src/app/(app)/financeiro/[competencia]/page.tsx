import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { contarExtrasPendentes, listarCobrancasDaCompetencia, previaNaoGerados } from "@/db/cobrancas";
import { hojeSP } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { BotoesCompetencia } from "./botoes-competencia";
import { TabelaCobrancas, type CobrancaTabela } from "./tabela-cobrancas";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function rotulo(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export default async function CompetenciaPage({ params }: { params: Promise<{ competencia: string }> }) {
  const { competencia } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) notFound();

  const usuario = await usuarioAtual();
  const podeOperar = !!usuario && pode(usuario.permissoes, "financeiro.operar");
  const [cobrancas, naoGerados, extrasPendentes] = await Promise.all([
    listarCobrancasDaCompetencia(competencia),
    previaNaoGerados(competencia),
    contarExtrasPendentes(competencia),
  ]);

  const hoje = hojeSP();
  const ativas = cobrancas.filter((c) => c.situacao !== "cancelada");
  const totalMes = ativas.reduce((s, c) => s + c.total, 0);
  const previstas = cobrancas.filter((c) => c.situacao === "prevista").length;
  const linhas: CobrancaTabela[] = cobrancas.map((c) => ({
    id: c.id,
    clienteNome: c.clienteNome,
    origem: c.origem,
    vencimento: c.vencimento,
    total: c.total,
    situacao: c.situacao,
    atrasada: ["emitida", "paga_parcial"].includes(c.situacao) && !c.saldo_dispensado && c.vencimento < hoje,
    motivoCancelamento: c.motivo_cancelamento,
    descricao: c.descricao,
    itens: c.itens.map((i) => ({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, refId: i.ref_id })),
  }));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Fechamento · ${rotulo(competencia)}`}
        descricao="Abra o mês para gerar uma cobrança prevista por contrato fechado de cliente ativo. Revise, ajuste itens ou exclua clientes do mês antes de exportar."
        acoes={podeOperar ? (
          <>
            {previstas > 0 && <Link href={`/financeiro/${competencia}/exportar`} className={buttonVariants({ variant: "outline" })}>Exportar</Link>}
            <BotoesCompetencia competencia={competencia} temCobrancas={cobrancas.length > 0} previstas={previstas} />
          </>
        ) : undefined}
      />

      <Card size="sm" className="px-4">
        <form method="get" action="/financeiro" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm font-medium"><span>Competência</span>
            <input type="month" name="competencia" defaultValue={competencia} className="campo font-normal" /></label>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>Ir</button>
          <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Cobranças</dt><dd className="font-semibold tabular-nums text-heading">{ativas.length}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Previstas</dt><dd className="font-semibold tabular-nums text-heading">{previstas}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Total do mês</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(totalMes)}</dd></div>
          </dl>
        </form>
      </Card>

      {extrasPendentes > 0 && cobrancas.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span>
            {extrasPendentes} extra(s) pendente(s) nesta competência ainda fora das cobranças.{" "}
            <Link href={`/extras?competencia=${competencia}`} className="font-semibold underline underline-offset-2">Ver extras</Link>
            {podeOperar && " · “Regerar previstas” só inclui os de clientes com cobrança prevista no mês; os de clientes excluídos do mês ou com cobrança já emitida continuam pendentes (cancele e relance em outra competência)."}
          </span>
        </p>
      )}

      {naoGerados.length > 0 && (
        <Card className="gap-3 px-0">
          <CardHeader><CardTitle><h2>Não gerados ({naoGerados.length})</h2></CardTitle></CardHeader>
          <ul className="divide-y divide-border px-5 text-sm">
            {naoGerados.map((n) => (
              <li key={n.clienteId} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2">
                <Link href={`/clientes/${n.clienteId}`} className="font-medium text-heading hover:underline">{n.clienteNome}</Link>
                <span className="text-muted-foreground">{n.motivo}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TabelaCobrancas competencia={competencia} cobrancas={linhas} podeOperar={podeOperar} />
    </div>
  );
}
