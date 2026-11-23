import Link from "next/link";
import { notFound } from "next/navigation";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Selo } from "@/components/situacao-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listarCarteiras } from "@/db/carteiras";
import { obterCliente } from "@/db/clientes";
import { listarDocumentosContrato, obterContrato } from "@/db/contratos";
import { pendenciasCadastro, ROTULOS_PENDENCIA } from "@/domain/completude";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { ROTULOS_SITUACAO_CONTRATO } from "@/domain/rotulos";
import type { ParcelaAdicional } from "@/domain/tipos";
import { usuarioAtual } from "@/lib/auth";
import { FormularioContrato } from "./formulario-contrato";
import { BotaoGerarContrato } from "./gerar/botao-gerar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROTULOS_CAMPO: Record<string, string> = { honorario: "Honorário", parcela_adicional_total: "Parcela adicional" };

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const k = await obterContrato(id);
  if (!k) notFound();

  const usuario = await usuarioAtual();
  const encerrado = k.situacao === "encerrado";
  const podeEditar = !!usuario && pode(usuario.permissoes, "contratos.editar") && !encerrado;
  const [carteiras, cliente, documentos] = await Promise.all([
    listarCarteiras(),
    k.legado ? Promise.resolve(null) : obterCliente(k.cliente.id),
    k.legado ? Promise.resolve([]) : listarDocumentosContrato(k.id),
  ]);
  const pendencias = cliente ? pendenciasCadastro(cliente) : [];
  const bloqueio = !usuario || !pode(usuario.permissoes, "contratos.editar")
    ? "Você não tem permissão para gerar contratos."
    : k.situacao !== "fechado"
      ? "Disponível quando o contrato estiver fechado."
      : k.cliente.situacao !== "ativo"
        ? "Disponível quando o cliente estiver ativo."
        : pendencias.length > 0
          ? `Resolva as pendências do cadastro: ${pendencias.map((p) => ROTULOS_PENDENCIA[p]).join(", ")}.`
          : null;
  const dataHora = (s: string) =>
    new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  const reais = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const parcelas: ParcelaAdicional[] = k.parcelas.map((p) => ({
    mes: p.mes, valor: p.valor, forma: p.forma as ParcelaAdicional["forma"], dia: p.dia,
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina
        titulo={`Contrato de ${k.cliente.razao_social}`}
        voltar={{ href: `/clientes/${k.cliente.id}`, rotulo: "Cliente" }}
      >
        <Selo tom={encerrado ? "neutro" : k.situacao === "fechado" ? "sucesso" : "alerta"}>
          {ROTULOS_SITUACAO_CONTRATO[k.situacao as keyof typeof ROTULOS_SITUACAO_CONTRATO]}
        </Selo>
      </CabecalhoPagina>

      <Card>
        <CardHeader>
          <CardTitle><h2>Dados do contrato</h2></CardTitle>
          {encerrado && <CardDescription>Contrato encerrado: somente leitura.</CardDescription>}
          {!encerrado && !podeEditar && <CardDescription>Somente leitura.</CardDescription>}
        </CardHeader>
        <CardContent>
          <FormularioContrato
            key={k.atualizado_em}
            somenteLeitura={!podeEditar}
            carteiras={carteiras.map((c) => ({ id: c.id, nome: c.nome }))}
            valores={{
              id: k.id, situacao: k.situacao, honorario: reais(k.honorario),
              dia_vencimento: k.dia_vencimento != null ? String(k.dia_vencimento) : "",
              data_inicio: k.data_inicio ?? "", carteira_id: k.carteira_id ?? "",
              tipo_cobranca: k.tipo_cobranca ?? "", email_cobranca: k.email_cobranca ?? k.cliente.email ?? "",
              parcela_adicional_total: reais(k.parcela_adicional_total), legado: k.legado,
              encerrado_em: k.encerrado_em ?? "", parcelas,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><h2>Documento do contrato</h2></CardTitle>
          {k.legado && <CardDescription>Contrato anterior (sem documento no CRM).</CardDescription>}
        </CardHeader>
        {!k.legado && (
          <CardContent className="space-y-4">
            <BotaoGerarContrato contratoId={k.id} bloqueio={bloqueio} />
            {documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão gerada.</p>
            ) : (
              <table className="tabela">
                <thead><tr><th>Gerado em</th><th>Por</th><th>Arquivos</th></tr></thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap">{dataHora(d.gerado_em)}</td>
                      <td>{d.geradoPorNome ?? "—"}</td>
                      <td className="space-x-3 whitespace-nowrap">
                        {d.docxUrl ? <a href={d.docxUrl} className="link">.docx</a> : <span className="text-muted-foreground">.docx indisponível</span>}
                        {d.pdfUrl ? <a href={d.pdfUrl} className="link">PDF</a> : <span className="text-muted-foreground">{d.pdf_path ? "PDF indisponível" : "sem PDF"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle><h2>Histórico de valores</h2></CardTitle></CardHeader>
        <CardContent>
          {k.historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração de valores registrada.</p>
          ) : (
            <table className="tabela">
              <thead><tr><th>Data</th><th>Campo</th><th>De</th><th>Para</th><th>Motivo</th></tr></thead>
              <tbody>
                {k.historico.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">{new Date(h.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                    <td>{ROTULOS_CAMPO[h.campo] ?? h.campo}</td>
                    <td className="tabular-nums">{h.de != null ? formatarBRL(h.de) : "—"}</td>
                    <td className="tabular-nums">{h.para != null ? formatarBRL(h.para) : "—"}</td>
                    <td>{h.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Link href="/contratos" className="link text-sm">Ver todos os contratos</Link>
    </div>
  );
}
