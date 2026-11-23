import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { SituacaoBadge } from "@/components/situacao-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { listarCarteiras } from "@/db/carteiras";
import { listarOpcoesIndicacao, obterCliente } from "@/db/clientes";
import { extratoCredito, listarIndicacoes } from "@/db/indicacoes";
import { pendenciasCadastro, ROTULOS_PENDENCIA } from "@/domain/completude";
import { formatarDocumento } from "@/domain/documentos";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { ROTULOS_SITUACAO_CLIENTE, ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import { usuarioAtual } from "@/lib/auth";
import { TabelaExtrato, TabelaIndicacoes } from "../../indicacoes/componentes";
import { FormularioIndicacao } from "../../indicacoes/formulario-indicacao";
import { FormularioCliente } from "../formulario-cliente";
import { ConfirmarCadastro } from "./confirmar-cadastro";
import { CriarContrato } from "./criar-contrato";
import { Socios } from "./socios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await obterCliente(id);
  if (!c) notFound();

  const usuario = await usuarioAtual();
  const podeEditar = !!usuario && pode(usuario.permissoes, "clientes.editar");
  const podeEditarContrato = !!usuario && pode(usuario.permissoes, "contratos.editar");
  const [opcoes, carteiras, indicacoes, extrato] = await Promise.all([
    listarOpcoesIndicacao(id), listarCarteiras(), listarIndicacoes({ clienteId: id }), extratoCredito(id),
  ]);
  const pendencias = pendenciasCadastro(c);
  const k = c.contrato;
  const carteira = carteiras.find((x) => x.id === k?.carteira_id)?.nome;
  const indicadoPor = indicacoes.find((i) => i.indicado.id === c.id) ?? null;
  const indicou = indicacoes.filter((i) => i.indicador.id === c.id);
  // indicado_por gravado antes do registro de indicações (importação/formulário antigo): não gera crédito
  const indicadoPorLegado = !indicadoPor && c.indicado_por ? (opcoes.find((o) => o.id === c.indicado_por)?.razao_social ?? "outro cliente") : null;
  const podeSerIndicado = !indicadoPor && !!k && (k.honorario ?? 0) > 0;

  const valores: Record<string, string> = {
    razao_social: c.razao_social, nome_fantasia: c.nome_fantasia ?? "",
    documento: c.documento ? formatarDocumento(c.documento) : "",
    codigo_dominio: c.codigo_dominio != null ? String(c.codigo_dominio) : "",
    logradouro: c.logradouro ?? "", numero: c.numero ?? "", complemento: c.complemento ?? "",
    bairro: c.bairro ?? "", cidade: c.cidade ?? "", uf: c.uf ?? "", cep: c.cep ?? "",
    telefone: c.telefone ?? "", email: c.email ?? "",
    inscricao_estadual: c.inscricao_estadual ?? "", inscricao_municipal: c.inscricao_municipal ?? "",
    regime: c.regime ?? "", observacoes: c.observacoes ?? "",
  };

  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina
        titulo={c.razao_social}
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        acoes={c.situacao === "a_revisar" && podeEditar ? (
          <ConfirmarCadastro clienteId={c.id} bloqueado={pendencias.includes("documento_invalido")} />
        ) : undefined}
      >
        <SituacaoBadge situacao={c.situacao} rotulo={ROTULOS_SITUACAO_CLIENTE[c.situacao as keyof typeof ROTULOS_SITUACAO_CLIENTE]} />
      </CabecalhoPagina>

      {(pendencias.length > 0 || c.campos_suspeitos.length > 0) && (
        <section className="space-y-2 rounded-xl border border-warning-border/60 bg-warning-soft px-5 py-4 text-sm">
          {pendencias.length > 0 && (
            <>
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <TriangleAlert className="size-4 text-warning" aria-hidden />
                Pendências ({pendencias.length})
              </h2>
              <ul className="list-disc space-y-0.5 pl-6">
                {pendencias.map((p) => <li key={p}>{ROTULOS_PENDENCIA[p]}</li>)}
              </ul>
            </>
          )}
          {c.campos_suspeitos.length > 0 && (
            <p className="font-medium text-warning">
              Campos para conferir (vindos da importação) estão destacados em amarelo no formulário.
            </p>
          )}
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle><h2>Cadastro</h2></CardTitle>
          {!podeEditar && <CardDescription>Somente leitura.</CardDescription>}
        </CardHeader>
        <CardContent>
          <FormularioCliente id={c.id} valores={valores} suspeitos={c.campos_suspeitos} somenteLeitura={!podeEditar} />
        </CardContent>
      </Card>

      <Socios
        clienteId={c.id}
        somenteLeitura={!podeEditar}
        socios={c.socios.map((s) => ({ id: s.id, nome: s.nome, cpf: s.cpf, participacao: s.participacao, administrador: s.administrador }))}
      />

      <Card>
        <CardHeader>
          <CardTitle><h2>Contrato</h2></CardTitle>
          {!k && <CardDescription>Sem contrato vigente.</CardDescription>}
        </CardHeader>
        {!k && podeEditarContrato && <CardContent><CriarContrato clienteId={c.id} /></CardContent>}
        {k && (
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div><dt className="text-xs font-medium text-muted-foreground">Honorário</dt><dd className="mt-0.5 font-heading text-base font-bold text-heading tabular-nums">{k.honorario != null ? formatarBRL(k.honorario) : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Vencimento</dt><dd className="mt-0.5 font-medium">{k.dia_vencimento != null ? `dia ${k.dia_vencimento}` : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Carteira</dt><dd className="mt-0.5 font-medium">{carteira ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Tipo de cobrança</dt>
                <dd className="mt-0.5 font-medium">{k.tipo_cobranca ? ROTULOS_TIPO_COBRANCA[k.tipo_cobranca as keyof typeof ROTULOS_TIPO_COBRANCA] : "—"}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">E-mail de cobrança</dt><dd className="mt-0.5 truncate font-medium">{k.email_cobranca ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Situação</dt><dd className="mt-0.5 font-medium">{k.situacao}{k.legado ? " (legado)" : ""}</dd></div>
            </dl>
            <Link href={`/contratos/${k.id}`} className="link inline-block text-sm">Abrir contrato</Link>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><h2>Indicações</h2></CardTitle>
          <CardDescription>
            {indicadoPor ? (
              <>Indicado por <Link href={`/clientes/${indicadoPor.indicador.id}`} className="link">{indicadoPor.indicador.nome}</Link>.</>
            ) : indicadoPorLegado ? (
              <>O cadastro aponta “{indicadoPorLegado}” como indicador, mas a indicação não foi registrada e não gera crédito.</>
            ) : "Cliente não indicado por outro cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!indicadoPor && podeEditar && (
            podeSerIndicado ? (
              <div className="space-y-2">
                <h3 className="font-heading text-sm font-bold text-heading">Registrar quem indicou este cliente</h3>
                <FormularioIndicacao indicadores={opcoes} indicadoFixo={c.id} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Para registrar quem indicou este cliente, ele precisa ter contrato com honorário.</p>
            )
          )}
          {indicou.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-bold text-heading">Clientes indicados</h3>
              <div className="-mx-5"><TabelaIndicacoes linhas={indicou} vazio="" /></div>
            </div>
          )}
          {(indicou.length > 0 || extrato.movimentos.length > 0) && (
            <div className="space-y-2">
              <h3 className="font-heading text-sm font-bold text-heading">Extrato de crédito</h3>
              <TabelaExtrato extrato={extrato} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
