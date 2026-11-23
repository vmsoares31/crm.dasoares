import "server-only";

import type { Tables } from "@/db/database.types";
import { createServerClient } from "@/lib/supabase/server";

export type Contrato = Tables<"contratos">;

export type CamposContratoLegado = {
  honorario: number | null;
  dia_vencimento: number | null;
  carteira_id: string | null;
  tipo_cobranca: string | null;
  email_cobranca: string | null;
};

/**
 * Edição em massa: se o cliente não tem contrato vigente, cria um contrato
 * legado (legado=true, situacao='fechado'); senão atualiza o contrato não encerrado.
 */
export async function upsertContratoLegado(
  clienteId: string,
  campos: CamposContratoLegado,
): Promise<{ id: string; criado: boolean }> {
  const supabase = await createServerClient();
  const { data: atual, error: erroBusca } = await supabase
    .from("contratos")
    .select("id")
    .eq("cliente_id", clienteId)
    .neq("situacao", "encerrado")
    .maybeSingle();
  if (erroBusca) throw new Error(`Falha ao buscar contrato: ${erroBusca.message}`);

  if (atual) {
    const { error } = await supabase.from("contratos").update(campos).eq("id", atual.id);
    if (error) throw new Error(`Falha ao atualizar contrato: ${error.message}`);
    return { id: atual.id, criado: false };
  }
  const { data, error } = await supabase
    .from("contratos")
    .insert({ ...campos, cliente_id: clienteId, legado: true, situacao: "fechado" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha ao criar contrato: ${error?.message}`);
  return { id: data.id, criado: true };
}

export type ParcelaRow = Tables<"parcelas_adicionais">;
export type HistoricoRow = Tables<"historico_valores">;
export type ClienteResumo = { id: string; razao_social: string; situacao: string; email: string | null };
export type ContratoDetalhe = Contrato & {
  cliente: ClienteResumo;
  parcelas: ParcelaRow[];
  historico: HistoricoRow[];
};

export const CONTRATOS_POR_PAGINA = 50;

export async function obterContrato(id: string): Promise<ContratoDetalhe | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contratos")
    .select("*, cliente:clientes(id, razao_social, situacao, email), parcelas:parcelas_adicionais(*), historico:historico_valores(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao obter contrato: ${error.message}`);
  if (!data) return null;
  const b = data as unknown as ContratoDetalhe;
  return {
    ...b,
    parcelas: [...(b.parcelas ?? [])].sort((x, y) => x.mes - y.mes),
    historico: [...(b.historico ?? [])].sort((x, y) => y.criado_em.localeCompare(x.criado_em)),
  };
}

/** Contrato vigente (não encerrado) do cliente, se houver. */
export async function contratoVigenteDoCliente(clienteId: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contratos").select("id").eq("cliente_id", clienteId).neq("situacao", "encerrado").maybeSingle();
  if (error) throw new Error(`Falha ao buscar contrato: ${error.message}`);
  return data?.id ?? null;
}

export type FiltroContratos = {
  busca?: string;
  situacao?: string;
  carteira?: string;
  legado?: string; // "sim" ou "nao"
  documento?: string; // "sem" = nenhum documento gerado
  pagina?: number;
};

export type ContratoLinha = Contrato & { cliente: { id: string; razao_social: string }; carteiraNome: string | null };

export async function listarContratos(f: FiltroContratos): Promise<{ linhas: ContratoLinha[]; total: number }> {
  const supabase = await createServerClient();
  const pagina = Math.max(1, f.pagina ?? 1);
  let q = supabase
    .from("contratos")
    .select(
      f.documento === "sem"
        ? "*, cliente:clientes!inner(id, razao_social), carteira:carteiras(nome), contrato_documentos!left(id)"
        : "*, cliente:clientes!inner(id, razao_social), carteira:carteiras(nome)",
      { count: "exact" },
    )
    .order("razao_social", { referencedTable: "clientes" })
    .order("id");
  const busca = (f.busca ?? "").trim().replace(/[,()%*\\]/g, " ").trim();
  if (busca) q = q.ilike("clientes.razao_social", `%${busca}%`);
  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (f.carteira) q = q.eq("carteira_id", f.carteira);
  if (f.legado === "sim") q = q.eq("legado", true);
  if (f.legado === "nao") q = q.eq("legado", false);
  if (f.documento === "sem") q = q.is("contrato_documentos", null);
  const { data, count, error } = await q.range((pagina - 1) * CONTRATOS_POR_PAGINA, pagina * CONTRATOS_POR_PAGINA - 1);
  if (error) throw new Error(`Falha ao listar contratos: ${error.message}`);
  const linhas = ((data ?? []) as unknown as (Contrato & { cliente: { id: string; razao_social: string }; carteira: { nome: string } | null })[])
    .map(({ carteira, ...k }) => ({ ...k, carteiraNome: carteira?.nome ?? null }));
  return { linhas, total: count ?? 0 };
}

export type DocumentoContrato = Tables<"contrato_documentos"> & {
  geradoPorNome: string | null;
  docxUrl: string | null;
  pdfUrl: string | null;
};

/** Versões geradas do contrato (mais recente primeiro), com links temporários de download. */
export async function listarDocumentosContrato(contratoId: string): Promise<DocumentoContrato[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contrato_documentos")
    .select("*")
    .eq("contrato_id", contratoId)
    .order("gerado_em", { ascending: false });
  if (error) throw new Error(`Falha ao listar documentos do contrato: ${error.message}`);
  const docs = data ?? [];
  if (docs.length === 0) return [];

  const ids = [...new Set(docs.map((d) => d.gerado_por).filter((x): x is string => !!x))];
  const { data: perfis } = ids.length
    ? await supabase.from("perfis").select("usuario_id, nome").in("usuario_id", ids)
    : { data: [] as { usuario_id: string; nome: string }[] };
  const nomes = new Map((perfis ?? []).map((p) => [p.usuario_id, p.nome]));

  const caminhos = docs.flatMap((d) => [d.docx_path, d.pdf_path].filter((x): x is string => !!x));
  const { data: assinadas } = await supabase.storage.from("contratos").createSignedUrls(caminhos, 60 * 10, { download: true });
  const urls = new Map((assinadas ?? []).filter((s) => !s.error && s.path).map((s) => [s.path as string, s.signedUrl]));

  return docs.map((d) => ({
    ...d,
    geradoPorNome: d.gerado_por ? (nomes.get(d.gerado_por) ?? null) : null,
    docxUrl: urls.get(d.docx_path) ?? null,
    pdfUrl: d.pdf_path ? (urls.get(d.pdf_path) ?? null) : null,
  }));
}
