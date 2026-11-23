import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listarExportaveis, listarSaidasCarteiras } from "@/db/exportacao";
import { sugerirVencimento } from "@/domain/cora-csv";
import { hojeSP } from "@/domain/datas";
import { ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import { exigirPermissaoPagina } from "@/lib/auth";
import { PainelExportacao, type LinhaExportacao } from "./painel-exportacao";

export default async function ExportarPage({
  params, searchParams,
}: {
  params: Promise<{ competencia: string }>;
  searchParams: Promise<{ carteira?: string; tipo?: string }>;
}) {
  const { competencia } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) notFound();
  await exigirPermissaoPagina("financeiro.operar");
  const { carteira = "", tipo = "" } = await searchParams;

  const [todas, carteiras] = await Promise.all([listarExportaveis(competencia), listarSaidasCarteiras()]);
  const hoje = hojeSP();
  const linhas: LinhaExportacao[] = todas
    .filter((c) => c.situacao === "prevista")
    .filter((c) => !carteira || (carteira === "_sem" ? !c.carteiraId : c.carteiraId === carteira))
    .filter((c) => !tipo || c.tipo === tipo)
    .map((c) => ({
      id: c.id, cliente: c.clienteNome, documento: c.documento, valor: c.total, vencimento: c.vencimento,
      descricao: c.descricao, tipo: c.tipo, carteira: c.carteiraNome, vencida: c.vencimento < hoje,
    }));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`Exportação · ${competencia.split("-").reverse().join("/")}`}
        voltar={{ href: `/financeiro/${competencia}`, rotulo: "Fechamento do mês" }}
        descricao="Baixe o arquivo de emissão em lote do Cora ou a lista manual das demais carteiras. Depois de emitir, marque as cobranças como emitidas."
        className="print:hidden"
      />

      <Card size="sm" className="px-4 print:hidden">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-sm font-medium"><span>Carteira</span>
            <select name="carteira" defaultValue={carteira} className="campo font-normal">
              <option value="">Todas</option>
              {carteiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="_sem">Sem carteira</option>
            </select></label>
          <label className="space-y-1.5 text-sm font-medium"><span>Tipo de cobrança</span>
            <select name="tipo" defaultValue={tipo} className="campo font-normal">
              <option value="">Todos</option>
              {Object.entries(ROTULOS_TIPO_COBRANCA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select></label>
          <span className="pb-2 text-sm text-muted-foreground">Situação: prevista</span>
          <button type="submit" className={buttonVariants({ variant: "outline" })}>Filtrar</button>
        </form>
      </Card>

      <PainelExportacao competencia={competencia} linhas={linhas} vencimentoSugerido={sugerirVencimento(hoje)} />
    </div>
  );
}
