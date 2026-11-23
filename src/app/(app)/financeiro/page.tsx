import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { GraficoBarrasCarteira } from "@/components/grafico-barras-carteira";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listarCarteiras } from "@/db/carteiras";
import { cobrancasDoPainel } from "@/db/painel";
import { formatarData, hojeSP } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { resumoFinanceiro, SEM_CARTEIRA } from "@/domain/painel";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function vizinha(competencia: string, delta: number): string {
  const [a, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Cartao({ rotulo, valor, nota, perigo }: { rotulo: string; valor: number; nota?: string; perigo?: boolean }) {
  return (
    <Card size="sm" className="px-4">
      <span className="text-sm font-medium text-muted-foreground">{rotulo}</span>
      <strong className={`block font-heading text-2xl font-extrabold tabular-nums ${perigo && valor > 0 ? "text-danger" : "text-heading"}`}>
        {formatarBRL(valor)}
      </strong>
      {nota && <span className="text-xs text-muted-foreground">{nota}</span>}
    </Card>
  );
}

/** Painel do mês: totais, previsto x recebido por carteira e cobranças ainda não emitidas. */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeSP();
  const competencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.competencia ?? "") ? sp.competencia! : hoje.slice(0, 7);
  const [a, m] = competencia.split("-").map(Number);

  const [cobrancas, carteiras] = await Promise.all([cobrancasDoPainel(competencia), listarCarteiras()]);
  const r = resumoFinanceiro(cobrancas, hoje);
  const nomes = new Map(carteiras.map((c) => [c.id, c.nome]));
  const barras = Object.entries(r.porCarteira)
    .map(([id, v]) => ({ rotulo: id === SEM_CARTEIRA ? "Sem carteira" : (nomes.get(id) ?? "Carteira removida"), ...v }))
    .sort((x, y) => y.previsto - x.previsto || x.rotulo.localeCompare(y.rotulo, "pt-BR"));
  const naoEmitidas = cobrancas
    .filter((c) => c.situacao === "prevista")
    .sort((x, y) => x.clienteNome.localeCompare(y.clienteNome, "pt-BR"));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Financeiro · ${MESES[m - 1]} de ${a}`}
        descricao="Visão do mês. Para gerar, ajustar e exportar as cobranças, abra o mês."
        acoes={
          <Link href={`/financeiro/${competencia}`} className={buttonVariants()}>
            Abrir/gerenciar o mês <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <Card size="sm" className="px-4">
        <div className="flex flex-wrap items-end gap-3">
          <Link href={`/financeiro?competencia=${vizinha(competencia, -1)}`} className={buttonVariants({ variant: "outline" })} aria-label="Mês anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <form method="get" className="flex items-end gap-3">
            <label className="space-y-1.5 text-sm font-medium"><span>Competência</span>
              <input type="month" name="competencia" defaultValue={competencia} className="campo font-normal" /></label>
            <button type="submit" className={buttonVariants({ variant: "outline" })}>Ir</button>
          </form>
          <Link href={`/financeiro?competencia=${vizinha(competencia, 1)}`} className={buttonVariants({ variant: "outline" })} aria-label="Próximo mês">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Link href="/financeiro/inadimplencia" className={`${buttonVariants({ variant: "ghost" })} sm:ml-auto`}>
            Ver inadimplência <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Card>

      <section aria-label="Totais do mês" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Cartao rotulo="Previsto" valor={r.previsto} nota="Total das cobranças do mês (sem canceladas)" />
        <Cartao rotulo="Emitido" valor={r.emitido} nota="Cobranças já emitidas, pagas ou não" />
        <Cartao rotulo="Recebido" valor={r.recebido} nota="Pagamentos registrados" />
        <Cartao rotulo="Em aberto" valor={r.emAberto} nota="Saldo a receber das emitidas" />
        <Cartao rotulo="Atrasado" valor={r.atrasado} nota="Em aberto com vencimento já passado" perigo />
        <Cartao rotulo="Não emitidas" valor={naoEmitidas.reduce((s, c) => s + c.total, 0)} nota={`${r.naoEmitidas} cobrança(s) ainda prevista(s)`} />
      </section>

      <Card size="sm" className="px-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Extras no mês</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(r.extras)}</dd></div>
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Parcelas adicionais</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(r.parcelasAdicionais)}</dd></div>
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Descontos de indicação</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(r.descontosIndicacao)}</dd></div>
        </dl>
      </Card>

      <Card className="gap-3 px-0">
        <CardHeader><CardTitle><h2>Previsto x recebido por carteira</h2></CardTitle></CardHeader>
        <div className="px-5 pb-1">
          {barras.length > 0 ? <GraficoBarrasCarteira dados={barras} /> : <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma cobrança nesta competência.</p>}
        </div>
      </Card>

      <Card className="gap-3 px-0">
        <CardHeader><CardTitle><h2>Não emitidas ({naoEmitidas.length})</h2></CardTitle></CardHeader>
        {naoEmitidas.length > 0 ? (
          <ul className="divide-y divide-border px-5 text-sm">
            {naoEmitidas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2">
                <Link href={`/financeiro/cobrancas/${c.id}`} className="font-medium text-heading hover:underline">{c.clienteNome}</Link>
                <span className="text-muted-foreground">
                  vence {formatarData(c.vencimento)} · <span className="font-semibold tabular-nums text-heading">{formatarBRL(c.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-2 text-sm text-muted-foreground">Todas as cobranças do mês já foram emitidas.</p>
        )}
      </Card>
    </div>
  );
}
