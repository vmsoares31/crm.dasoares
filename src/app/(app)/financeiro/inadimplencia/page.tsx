import Link from "next/link";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { SeloCobranca } from "@/components/selo-cobranca";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listarCobrancasAtrasadas } from "@/db/cobrancas";
import { obterEscritorio } from "@/db/escritorio";
import { formatarData, hojeSP } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { agruparInadimplencia, valorAtualizado } from "@/domain/encargos";

function formatarPct(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export default async function InadimplenciaPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const sp = await searchParams;
  const porCliente = sp.ver === "cliente";
  const [atrasadas, escritorio] = await Promise.all([listarCobrancasAtrasadas(), obterEscritorio()]);
  const multaPct = Number(escritorio.multa_pct);
  const jurosPct = Number(escritorio.juros_mes_pct);

  const hoje = hojeSP();
  const linhas = atrasadas.map((c) => {
    const a = valorAtualizado(c.saldoAberto, c.vencimento, hoje, multaPct, jurosPct);
    return { ...c, diasAtraso: a.diasAtraso, multa: a.multa, juros: a.juros, total: a.total, totalCobranca: c.total };
  });
  const grupos = agruparInadimplencia(linhas);
  const saldoTotal = linhas.reduce((s, l) => s + l.saldoAberto, 0);
  const devidoTotal = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Inadimplência"
        descricao={`Cobranças emitidas ou pagas parcialmente, vencidas e com saldo em aberto. Valor atualizado com multa de ${formatarPct(multaPct)} e juros de ${formatarPct(jurosPct)} ao mês pró-rata dia (cadastro do escritório).`}
      />

      <Card size="sm" className="px-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="group" aria-label="Agrupamento">
            <Link
              href="/financeiro/inadimplencia"
              aria-current={!porCliente ? "page" : undefined}
              className={buttonVariants({ variant: porCliente ? "ghost" : "default", size: "sm" })}
            >
              Por cobrança
            </Link>
            <Link
              href="/financeiro/inadimplencia?ver=cliente"
              aria-current={porCliente ? "page" : undefined}
              className={buttonVariants({ variant: porCliente ? "default" : "ghost", size: "sm" })}
            >
              Por cliente
            </Link>
          </div>
          <dl className="ml-auto flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Cobranças</dt><dd className="font-semibold tabular-nums text-heading">{linhas.length}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Clientes</dt><dd className="font-semibold tabular-nums text-heading">{grupos.length}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Saldo em aberto</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(saldoTotal)}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Total atualizado</dt><dd className="font-semibold tabular-nums text-danger">{formatarBRL(devidoTotal)}</dd></div>
          </dl>
        </div>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          {porCliente ? (
            <table className="tabela">
              <thead>
                <tr><th>Cliente</th><th>Cobranças</th><th>Maior atraso</th><th>Saldo em aberto</th><th>Total devido</th></tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.clienteId}>
                    <td className="max-w-80">
                      <Link href={`/clientes/${g.clienteId}`} className="block truncate font-medium hover:underline">{g.clienteNome}</Link>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        {g.itens.map((i) => (
                          <Link key={i.id} href={`/financeiro/cobrancas/${i.id}`} className="underline underline-offset-2">{formatarData(i.vencimento)}</Link>
                        ))}
                      </span>
                    </td>
                    <td className="tabular-nums">{g.itens.length}</td>
                    <td className="whitespace-nowrap tabular-nums">{Math.max(...g.itens.map((i) => i.diasAtraso))} dia(s)</td>
                    <td className="whitespace-nowrap tabular-nums">{formatarBRL(g.itens.reduce((s, i) => s + i.saldoAberto, 0))}</td>
                    <td className="whitespace-nowrap font-semibold tabular-nums text-heading">{formatarBRL(g.total)}</td>
                  </tr>
                ))}
                {grupos.length === 0 && <Vazio colunas={5} />}
              </tbody>
            </table>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Cliente</th><th>Vencimento</th><th>Atraso</th><th>Situação</th><th>Saldo em aberto</th><th>Multa + juros</th><th>Valor atualizado</th></tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-80">
                      <Link href={`/financeiro/cobrancas/${l.id}`} className="block truncate font-medium hover:underline">{l.clienteNome}</Link>
                    </td>
                    <td className="whitespace-nowrap">{formatarData(l.vencimento)}</td>
                    <td className="whitespace-nowrap tabular-nums">{l.diasAtraso} dia(s)</td>
                    <td className="whitespace-nowrap">
                      {l.situacao === "paga_parcial" ? <SeloCobranca situacao="paga_parcial" /> : <SeloCobranca situacao={l.situacao} atrasada />}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{formatarBRL(l.saldoAberto)}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatarBRL(l.multa + l.juros)}</td>
                    <td className="whitespace-nowrap font-semibold tabular-nums text-heading">{formatarBRL(l.total)}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <Vazio colunas={7} />}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function Vazio({ colunas }: { colunas: number }) {
  return (
    <tr><td colSpan={colunas} className="py-10 text-center text-muted-foreground">Nenhuma cobrança em atraso.</td></tr>
  );
}
