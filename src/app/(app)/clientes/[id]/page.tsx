import Link from "next/link";
import { notFound } from "next/navigation";

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
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">{c.razao_social}</h1>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">
          {ROTULOS_SITUACAO_CLIENTE[c.situacao as keyof typeof ROTULOS_SITUACAO_CLIENTE]}
        </span>
        <Link href="/clientes" className="text-sm underline">Voltar</Link>
      </div>

      {c.situacao === "a_revisar" && podeEditar && (
        <ConfirmarCadastro clienteId={c.id} bloqueado={pendencias.includes("documento_invalido")} />
      )}

      {pendencias.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-lg font-medium">Pendências ({pendencias.length})</h2>
          <ul className="list-disc pl-5 text-sm">
            {pendencias.map((p) => <li key={p}>{ROTULOS_PENDENCIA[p]}</li>)}
          </ul>
        </section>
      )}

      {c.campos_suspeitos.length > 0 && (
        <p className="rounded border border-yellow-500 bg-yellow-100 px-3 py-2 text-sm text-foreground">
          Campos para conferir (vindos da importação) estão destacados em amarelo no formulário.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cadastro</h2>
        {!podeEditar && <p className="text-sm text-muted-foreground">Somente leitura.</p>}
        <FormularioCliente id={c.id} valores={valores} suspeitos={c.campos_suspeitos} opcoesIndicacao={opcoes} somenteLeitura={!podeEditar} />
      </section>

      <Socios
        clienteId={c.id}
        somenteLeitura={!podeEditar}
        socios={c.socios.map((s) => ({ id: s.id, nome: s.nome, cpf: s.cpf, participacao: s.participacao, administrador: s.administrador }))}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contrato</h2>
        {k ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Honorário</dt><dd>{k.honorario != null ? formatarBRL(k.honorario) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Vencimento</dt><dd>{k.dia_vencimento != null ? `dia ${k.dia_vencimento}` : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Carteira</dt><dd>{carteira ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Tipo de cobrança</dt>
              <dd>{k.tipo_cobranca ? ROTULOS_TIPO_COBRANCA[k.tipo_cobranca as keyof typeof ROTULOS_TIPO_COBRANCA] : "—"}</dd></div>
            <div><dt className="text-muted-foreground">E-mail de cobrança</dt><dd>{k.email_cobranca ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Situação</dt><dd>{k.situacao}{k.legado ? " (legado)" : ""}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Sem contrato. Use a edição em massa para cadastrar os dados de cobrança.</p>
        )}
      </section>
    </div>
  );
}
