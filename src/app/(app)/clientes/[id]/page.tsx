import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { SituacaoBadge } from "@/components/situacao-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { listarCarteiras } from "@/db/carteiras";
import { listarOpcoesIndicacao, obterCliente } from "@/db/clientes";
import { pendenciasCadastro, ROTULOS_PENDENCIA } from "@/domain/completude";
import { formatarDocumento } from "@/domain/documentos";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { ROTULOS_SITUACAO_CLIENTE, ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
import { usuarioAtual } from "@/lib/auth";
import { FormularioCliente } from "../formulario-cliente";
import { ConfirmarCadastro } from "./confirmar-cadastro";
import { Socios } from "./socios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const c = await obterCliente(id);
  if (!c) notFound();

  const usuario = await usuarioAtual();
  const podeEditar = !!usuario && pode(usuario.permissoes, "clientes.editar");
  const [opcoes, carteiras] = await Promise.all([listarOpcoesIndicacao(id), listarCarteiras()]);
  const pendencias = pendenciasCadastro(c);
  const k = c.contrato;
  const carteira = carteiras.find((x) => x.id === k?.carteira_id)?.nome;

  const valores: Record<string, string> = {
    razao_social: c.razao_social, nome_fantasia: c.nome_fantasia ?? "",
    documento: c.documento ? formatarDocumento(c.documento) : "",
    codigo_dominio: c.codigo_dominio != null ? String(c.codigo_dominio) : "",
    logradouro: c.logradouro ?? "", numero: c.numero ?? "", complemento: c.complemento ?? "",
    bairro: c.bairro ?? "", cidade: c.cidade ?? "", uf: c.uf ?? "", cep: c.cep ?? "",
    telefone: c.telefone ?? "", email: c.email ?? "",
    inscricao_estadual: c.inscricao_estadual ?? "", inscricao_municipal: c.inscricao_municipal ?? "",
    regime: c.regime ?? "", indicado_por: c.indicado_por ?? "", observacoes: c.observacoes ?? "",
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
          <FormularioCliente id={c.id} valores={valores} suspeitos={c.campos_suspeitos} opcoesIndicacao={opcoes} somenteLeitura={!podeEditar} />
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
          {!k && <CardDescription>Sem contrato. Use a edição em massa para cadastrar os dados de cobrança.</CardDescription>}
        </CardHeader>
        {k && (
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div><dt className="text-xs font-medium text-muted-foreground">Honorário</dt><dd className="mt-0.5 font-heading text-base font-bold text-heading tabular-nums">{k.honorario != null ? formatarBRL(k.honorario) : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Vencimento</dt><dd className="mt-0.5 font-medium">{k.dia_vencimento != null ? `dia ${k.dia_vencimento}` : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Carteira</dt><dd className="mt-0.5 font-medium">{carteira ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Tipo de cobrança</dt>
                <dd className="mt-0.5 font-medium">{k.tipo_cobranca ? ROTULOS_TIPO_COBRANCA[k.tipo_cobranca as keyof typeof ROTULOS_TIPO_COBRANCA] : "—"}</dd></div>
              <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">E-mail de cobrança</dt><dd className="mt-0.5 truncate font-medium">{k.email_cobranca ?? "—"}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Situação</dt><dd className="mt-0.5 font-medium">{k.situacao}{k.legado ? " (legado)" : ""}</dd></div>
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
