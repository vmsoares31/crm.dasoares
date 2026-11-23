import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Selo, type TomSelo } from "@/components/situacao-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listarOpcoesIndicacao } from "@/db/clientes";
import { listarExtrasDaCompetencia } from "@/db/extras";
import { listarServicosExtras } from "@/db/servicos-extras";
import { formatarData, hojeSP } from "@/domain/datas";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { BotaoCancelarExtra } from "./botao-cancelar";
import { FormularioExtra } from "./formulario-extra";

const SITUACOES: Record<string, { rotulo: string; tom: TomSelo }> = {
  pendente: { rotulo: "Pendente", tom: "alerta" },
  incluido: { rotulo: "Incluído na cobrança", tom: "sucesso" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export default async function ExtrasPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeSP(); // data de hoje em America/Sao_Paulo
  const competencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.competencia ?? "") ? sp.competencia! : hoje.slice(0, 7);

  const usuario = await usuarioAtual();
  const podeOperar = !!usuario && pode(usuario.permissoes, "financeiro.operar");
  const [extras, clientes, servicos] = await Promise.all([
    listarExtrasDaCompetencia(competencia),
    podeOperar ? listarOpcoesIndicacao() : Promise.resolve([]),
    podeOperar ? listarServicosExtras({ ativos: true }) : Promise.resolve([]),
  ]);
  const totalPendente = extras.filter((e) => e.situacao === "pendente").reduce((s, e) => s + e.valor, 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Extras"
        descricao="Serviços cobrados à parte do honorário. Os extras pendentes entram na cobrança do mês do cliente."
      />

      {podeOperar && (
        <Card className="gap-4 px-0">
          <CardHeader><CardTitle><h2>Lançar extra</h2></CardTitle></CardHeader>
          <FormularioExtra
            clientes={clientes}
            servicos={servicos.map((s) => ({ id: s.id, nome: s.nome, valor: formatarBRL(s.valor) }))}
            competenciaPadrao={competencia}
            dataPadrao={hoje}
          />
        </Card>
      )}

      <Card size="sm" className="px-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm font-medium"><span>Competência</span>
            <input type="month" name="competencia" defaultValue={competencia} className="campo font-normal" /></label>
          <button type="submit" className={buttonVariants()}>Filtrar</button>
          <p className="ml-auto text-sm text-muted-foreground">
            {extras.length} lançamento(s) · pendente: <span className="font-semibold tabular-nums text-heading">{formatarBRL(totalPendente)}</span>
          </p>
        </form>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr><th>Cliente</th><th>Descrição</th><th>Data</th><th>Valor</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {extras.map((e) => {
                const s = SITUACOES[e.situacao] ?? { rotulo: e.situacao, tom: "neutro" as TomSelo };
                return (
                  <tr key={e.id}>
                    <td className="max-w-72"><span className="block truncate">{e.clienteNome}</span></td>
                    <td className="max-w-72">
                      <span className="block truncate">{e.descricao}</span>
                      {e.observacao && <span className="block truncate text-xs text-muted-foreground">{e.observacao}</span>}
                    </td>
                    <td className="whitespace-nowrap">{formatarData(e.data)}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatarBRL(e.valor)}</td>
                    <td className="whitespace-nowrap"><Selo tom={s.tom}>{s.rotulo}</Selo></td>
                    <td className="text-right">{podeOperar && e.situacao === "pendente" && <BotaoCancelarExtra id={e.id} />}</td>
                  </tr>
                );
              })}
              {extras.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum extra nesta competência.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
