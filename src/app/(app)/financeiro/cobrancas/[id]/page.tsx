import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { SeloCobranca } from "@/components/selo-cobranca";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { obterCobranca } from "@/db/cobrancas";
import { obterEscritorio } from "@/db/escritorio";
import { acoesDaCobranca } from "@/domain/baixa";
import { formatarData, hojeSP } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { valorAtualizado } from "@/domain/encargos";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { AcoesCobranca } from "./acoes-cobranca";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS_ITEM: Record<string, string> = {
  mensalidade: "Mensalidade",
  extra: "Extra",
  parcela_adicional: "Parcela adicional",
  desconto_indicacao: "Desconto indicação",
};
const TIPOS_MOVIMENTO: Record<string, string> = {
  gerado: "Gerado",
  liberado: "Liberado",
  usado: "Usado nesta cobrança",
  estornado: "Estornado ao saldo",
};

export default async function CobrancaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [c, escritorio, usuario] = await Promise.all([obterCobranca(id), obterEscritorio(), usuarioAtual()]);
  if (!c) notFound();
  const podeOperar = !!usuario && pode(usuario.permissoes, "financeiro.operar");

  const hoje = hojeSP();
  const emAberto = ["emitida", "paga_parcial"].includes(c.situacao) && !c.saldo_dispensado;
  const saldo = emAberto ? Math.max(c.total - c.valor_recebido, 0) : 0;
  const atrasada = emAberto && saldo > 0 && c.vencimento < hoje;
  const atualizado = atrasada
    ? valorAtualizado(saldo, c.vencimento, hoje, Number(escritorio.multa_pct), Number(escritorio.juros_mes_pct))
    : null;
  const acrescimo = c.situacao === "paga" ? Math.max(c.valor_recebido - c.total, 0) : 0;
  const acoes = acoesDaCobranca(c.situacao, c.saldo_dispensado);
  const [ano, mes] = c.competencia.split("-");

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        voltar={{ href: `/financeiro/${c.competencia}`, rotulo: "Fechamento do mês" }}
        titulo={c.clienteNome}
        descricao={`Cobrança ${c.origem === "mensal" ? "mensal" : "de parcela avulsa"} · competência ${mes}/${ano}`}
      >
        <SeloCobranca situacao={c.situacao} atrasada={atrasada} saldoDispensado={c.saldo_dispensado} />
      </CabecalhoPagina>

      <Card size="sm" className="px-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-muted-foreground">Vencimento</dt><dd className="font-semibold text-heading">{formatarData(c.vencimento)}</dd></div>
          <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(c.total)}</dd></div>
          <div><dt className="text-muted-foreground">Recebido</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(c.valor_recebido)}</dd></div>
          <div><dt className="text-muted-foreground">Saldo em aberto</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(saldo)}</dd></div>
          {atualizado && (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Valor atualizado ({atualizado.diasAtraso} dia(s) de atraso)</dt>
              <dd className="font-semibold tabular-nums text-danger">
                {formatarBRL(atualizado.total)}
                <span className="ml-2 font-normal text-muted-foreground">
                  saldo {formatarBRL(saldo)} + multa {formatarBRL(atualizado.multa)} + juros {formatarBRL(atualizado.juros)}
                </span>
              </dd>
            </div>
          )}
          {acrescimo > 0 && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Acréscimo recebido (multa/juros)</dt>
              <dd className="font-semibold tabular-nums text-heading">{formatarBRL(acrescimo)}</dd>
            </div>
          )}
          {c.pago_em && <div><dt className="text-muted-foreground">Paga em</dt><dd className="font-semibold text-heading">{formatarData(c.pago_em)}</dd></div>}
        </dl>
        {c.motivo_cancelamento && <p className="mt-3 text-sm text-muted-foreground">Motivo do cancelamento: {c.motivo_cancelamento}</p>}
        {c.saldo_dispensado && c.motivo_dispensa && <p className="mt-3 text-sm text-muted-foreground">Saldo dispensado: {c.motivo_dispensa}</p>}
      </Card>

      {podeOperar && (acoes.baixa || acoes.cancelar || acoes.dispensar) && (
        <AcoesCobranca id={c.id} acoes={acoes} saldo={saldo} hoje={hoje} temCreditoUsado={c.movimentos.some((m) => m.tipo === "usado")} />
      )}
      {podeOperar && c.situacao === "prevista" && (
        <p className="text-sm text-muted-foreground">
          A baixa fica disponível depois que a cobrança é marcada como emitida em{" "}
          <Link href={`/financeiro/${c.competencia}/exportar`} className="font-medium underline underline-offset-2">Exportar</Link>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3 px-0">
          <CardHeader><CardTitle><h2>Itens</h2></CardTitle></CardHeader>
          <ul className="divide-y divide-border px-5 text-sm">
            {c.itens.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2">
                <span><span className="text-muted-foreground">{TIPOS_ITEM[i.tipo] ?? i.tipo} · </span>{i.descricao}</span>
                <span className="tabular-nums">{formatarBRL(i.valor)}</span>
              </li>
            ))}
          </ul>
          {c.descricao && <p className="px-5 text-xs text-muted-foreground">Descrição: {c.descricao}</p>}
        </Card>

        <Card className="gap-3 px-0">
          <CardHeader><CardTitle><h2>Pagamentos</h2></CardTitle></CardHeader>
          {c.pagamentos.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="divide-y divide-border px-5 text-sm">
              {c.pagamentos.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-2">
                  <span>{formatarData(p.data)}</span>
                  <span className="tabular-nums">{formatarBRL(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          {c.movimentos.length > 0 && (
            <>
              <h3 className="px-5 pt-2 text-sm font-semibold text-heading">Crédito de indicação</h3>
              <ul className="divide-y divide-border px-5 text-sm">
                {c.movimentos.map((m) => {
                  const deOutro = m.cliente_id !== c.cliente_id;
                  return (
                    <li key={m.id} className="flex justify-between gap-4 py-2">
                      <span>
                        {m.tipo === "liberado" && deOutro ? "Liberado ao indicador" : (TIPOS_MOVIMENTO[m.tipo] ?? m.tipo)}
                        {deOutro && (
                          <Link href={`/clientes/${m.cliente_id}`} className="ml-1 text-muted-foreground underline underline-offset-2">ver cliente</Link>
                        )}
                      </span>
                      <span className="tabular-nums">{formatarBRL(m.valor)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
