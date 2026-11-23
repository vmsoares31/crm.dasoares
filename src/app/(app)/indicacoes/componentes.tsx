import Link from "next/link";

import { Selo, type TomSelo } from "@/components/situacao-badge";
import type { ExtratoCredito, IndicacaoLinha, TipoMovimento } from "@/db/indicacoes";
import { formatarBRL } from "@/domain/dinheiro";
import type { SituacaoIndicacao } from "@/domain/indicacao";

const SITUACOES: Record<SituacaoIndicacao, { rotulo: string; tom: TomSelo }> = {
  aguardando: { rotulo: "Aguardando 1º pagamento", tom: "alerta" },
  liberado: { rotulo: "Liberado", tom: "sucesso" },
  usado: { rotulo: "Usado", tom: "neutro" },
};

const MOVIMENTOS: Record<TipoMovimento, { rotulo: string; sinal: "" | "+" | "−" }> = {
  gerado: { rotulo: "Gerado (aguarda liberação)", sinal: "" },
  liberado: { rotulo: "Liberado", sinal: "+" },
  usado: { rotulo: "Usado em cobrança", sinal: "−" },
  estornado: { rotulo: "Estornado (cobrança cancelada)", sinal: "+" },
};

/** Data (dd/mm/aaaa) de um timestamp, no fuso de São Paulo. */
export function dataSP(ts: string): string {
  return new Date(ts).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function SeloIndicacao({ situacao }: { situacao: SituacaoIndicacao }) {
  const s = SITUACOES[situacao];
  return <Selo tom={s.tom}>{s.rotulo}</Selo>;
}

export function TabelaIndicacoes({ linhas, vazio }: { linhas: IndicacaoLinha[]; vazio: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr><th>Indicador</th><th>Indicado</th><th>Registrada em</th><th>Crédito</th><th>Situação</th></tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td className="max-w-72"><Link href={`/clientes/${l.indicador.id}`} className="block truncate font-medium hover:underline">{l.indicador.nome}</Link></td>
              <td className="max-w-72"><Link href={`/clientes/${l.indicado.id}`} className="block truncate hover:underline">{l.indicado.nome}</Link></td>
              <td className="whitespace-nowrap">{dataSP(l.criadoEm)}</td>
              <td className="whitespace-nowrap font-semibold tabular-nums text-heading">
                {formatarBRL(l.valor)}
                {l.situacao === "liberado" && l.consumido > 0 && (
                  <span className="block text-xs font-normal text-muted-foreground">{formatarBRL(l.consumido)} já usado</span>
                )}
              </td>
              <td className="whitespace-nowrap"><SeloIndicacao situacao={l.situacao} /></td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">{vazio}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TabelaExtrato({ extrato }: { extrato: ExtratoCredito }) {
  return (
    <div className="space-y-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5"><dt className="text-muted-foreground">Saldo disponível</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(extrato.saldoDisponivel)}</dd></div>
        <div className="flex gap-1.5"><dt className="text-muted-foreground">Aguardando liberação</dt><dd className="font-semibold tabular-nums">{formatarBRL(extrato.aLiberar)}</dd></div>
      </dl>
      {extrato.movimentos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Movimento</th><th>Origem</th><th>Valor</th></tr></thead>
            <tbody>
              {extrato.movimentos.map((m) => {
                const t = MOVIMENTOS[m.tipo];
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{dataSP(m.criadoEm)}</td>
                    <td className="whitespace-nowrap">{t.rotulo}</td>
                    <td className="max-w-72">
                      {m.indicado ? (
                        <Link href={`/clientes/${m.indicado.id}`} className="block truncate hover:underline">Indicação de {m.indicado.nome}</Link>
                      ) : m.cobrancaId ? (
                        <Link href={`/financeiro/cobrancas/${m.cobrancaId}`} className="hover:underline">Ver cobrança</Link>
                      ) : "—"}
                    </td>
                    <td className={`whitespace-nowrap tabular-nums ${t.sinal === "" ? "text-muted-foreground" : "font-semibold text-heading"}`}>
                      {t.sinal}{formatarBRL(m.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
