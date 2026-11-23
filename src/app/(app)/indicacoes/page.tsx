import Link from "next/link";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listarOpcoesIndicacao } from "@/db/clientes";
import { obterEscritorio } from "@/db/escritorio";
import { listarIndicacoes, listarIndicaveis } from "@/db/indicacoes";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { TabelaIndicacoes } from "./componentes";
import { FormularioIndicacao } from "./formulario-indicacao";

export default async function IndicacoesPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const sp = await searchParams;
  const usuario = await usuarioAtual();
  const podeEditar = !!usuario && pode(usuario.permissoes, "clientes.editar");
  const [linhas, escritorio, indicadores, indicaveis] = await Promise.all([
    listarIndicacoes(),
    obterEscritorio(),
    podeEditar ? listarOpcoesIndicacao() : Promise.resolve([]),
    podeEditar ? listarIndicaveis() : Promise.resolve([]),
  ]);
  const pct = Number(escritorio.indicacao_pct).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const total = (s: string) => linhas.filter((l) => l.situacao === s).reduce((t, l) => t + l.valor - l.consumido, 0);

  const filtradas = ["aguardando", "liberado", "usado", "baixada"].includes(sp.situacao ?? "")
    ? linhas.filter((l) => l.situacao === sp.situacao)
    : linhas.filter((l) => l.situacao !== "baixada"); // a lista padrão esconde as baixadas

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Indicações"
        descricao={`Quem indica um novo cliente ganha crédito de ${pct}% do honorário do indicado, liberado quando a primeira cobrança do indicado é paga e descontado nas cobranças seguintes do indicador.`}
      />

      {podeEditar && (
        <Card>
          <CardHeader>
            <CardTitle><h2>Registrar indicação</h2></CardTitle>
            <CardDescription>Só aparecem como indicados clientes com contrato vigente com honorário e ainda não indicados.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioIndicacao indicadores={indicadores} indicados={indicaveis} />
          </CardContent>
        </Card>
      )}

      <Card size="sm" className="px-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Indicações</dt><dd className="font-semibold tabular-nums text-heading">{linhas.filter((l) => l.situacao !== "baixada").length}</dd></div>
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Aguardando 1º pagamento</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(total("aguardando"))}</dd></div>
          {sp.situacao && (
            <div className="flex gap-1.5"><dt className="text-muted-foreground">Filtro</dt><dd className="font-semibold text-heading">{filtradas.length} {sp.situacao} · <Link href="/indicacoes" className="underline underline-offset-2">limpar</Link></dd></div>
          )}
          <div className="flex gap-1.5"><dt className="text-muted-foreground">Liberado a usar</dt><dd className="font-semibold tabular-nums text-heading">{formatarBRL(total("liberado"))}</dd></div>
        </dl>
      </Card>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filtrar por situação">
        {[["", "Ativas"], ["aguardando", "Aguardando 1º pagamento"], ["liberado", "Liberadas"], ["usado", "Usadas"], ["baixada", "Baixadas"]].map(([v, r]) => (
          <Link key={v} href={v ? `/indicacoes?situacao=${v}` : "/indicacoes"} className={(sp.situacao ?? "") === v ? "font-bold text-heading underline underline-offset-4" : "link"}>{r}</Link>
        ))}
      </nav>

      <Card className="py-0">
        <TabelaIndicacoes linhas={filtradas} vazio={sp.situacao ? "Nenhuma indicação nesta situação." : "Nenhuma indicação registrada."} podeBaixar={podeEditar} />
      </Card>
    </div>
  );
}
