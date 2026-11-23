import "server-only";

import type { Tables } from "@/db/database.types";
import { pendenciasCadastro, type ClienteCompleto, type Pendencia } from "@/domain/completude";
import { somenteDigitos } from "@/domain/documentos";
import { buscarTodas } from "@/db/paginar";
import { createServerClient } from "@/lib/supabase/server";

export const POR_PAGINA = 50;

export type FiltroClientes = {
  busca?: string;
  regime?: string;
  carteira?: string;
  situacao?: string;
  pendencias?: boolean;
  pagina?: number;
};

export type ClienteLinha = ClienteCompleto & { pendencias: Pendencia[]; carteiraNome: string | null };

type Bruto = Tables<"clientes"> & { socios: Tables<"socios">[]; contratos: Tables<"contratos">[] };

function montar(b: Bruto): ClienteCompleto {
  const { socios, contratos, ...c } = b;
  return { ...c, socios, contrato: contratos.find((k) => k.situacao !== "encerrado") ?? null };
}

export async function listarClientes(f: FiltroClientes): Promise<{ linhas: ClienteLinha[]; total: number }> {
  const supabase = await createServerClient();
  const pagina = Math.max(1, f.pagina ?? 1);
  const porCarteira = !!f.carteira;

  let q = supabase
    .from("clientes")
    .select(porCarteira ? "*, socios(*), contratos!inner(*)" : "*, socios(*), contratos(*)", { count: "exact" })
    .order("razao_social");

  const busca = (f.busca ?? "").trim().replace(/[,()%*\\]/g, " ").trim();
  if (busca) {
    const dig = somenteDigitos(busca);
    const partes = [`razao_social.ilike.%${busca}%`, `nome_fantasia.ilike.%${busca}%`];
    if (dig) partes.push(`documento.ilike.%${dig}%`);
    q = q.or(partes.join(","));
  }
  if (f.regime) q = q.eq("regime", f.regime);
  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (porCarteira) q = q.eq("contratos.carteira_id", f.carteira!).neq("contratos.situacao", "encerrado");

  q = q.order("id");
  let data: unknown[];
  let count: number | null = null;
  if (f.pendencias) {
    // Pendências são calculadas em JS: busca todas as linhas (paginando o limite de 1000 do PostgREST).
    data = await buscarTodas<unknown>((de, ate) => q.range(de, ate) as never);
  } else {
    const r = await q.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
    if (r.error) throw new Error(`Falha ao listar clientes: ${r.error.message}`);
    data = r.data ?? [];
    count = r.count;
  }

  const { data: carteiras } = await supabase.from("carteiras").select("id, nome");
  const nomes = new Map((carteiras ?? []).map((c) => [c.id, c.nome]));

  let linhas: ClienteLinha[] = (data as unknown as Bruto[]).map((b) => {
    const c = montar(b);
    return { ...c, pendencias: pendenciasCadastro(c), carteiraNome: c.contrato?.carteira_id ? (nomes.get(c.contrato.carteira_id) ?? null) : null };
  });
  let total = count ?? linhas.length;
  if (f.pendencias) {
    linhas = linhas.filter((l) => l.pendencias.length > 0);
    total = linhas.length;
    linhas = linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  }
  return { linhas, total };
}

export async function obterCliente(id: string): Promise<ClienteCompleto | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("*, socios(*), contratos(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao obter cliente: ${error.message}`);
  if (!data) return null;
  const c = montar(data as unknown as Bruto);
  c.socios.sort((a, b) => Number(b.administrador) - Number(a.administrador) || a.nome.localeCompare(b.nome));
  return c;
}

export async function listarClientesParaMassa(): Promise<ClienteLinha[]> {
  const supabase = await createServerClient();
  const data = await buscarTodas<unknown>(
    (de, ate) =>
      supabase
        .from("clientes")
        .select("*, socios(*), contratos(*)")
        .in("situacao", ["ativo", "a_revisar"])
        .order("razao_social")
        .order("id")
        .range(de, ate) as never,
  );
  return (data as Bruto[]).map((b) => {
    const c = montar(b);
    return { ...c, pendencias: pendenciasCadastro(c), carteiraNome: null };
  });
}

export async function listarOpcoesIndicacao(excluirId?: string): Promise<{ id: string; razao_social: string }[]> {
  const supabase = await createServerClient();
  const data = await buscarTodas<{ id: string; razao_social: string }>(
    (de, ate) => supabase.from("clientes").select("id, razao_social").order("razao_social").order("id").range(de, ate) as never,
  );
  return data.filter((c) => c.id !== excluirId);
}

/**
 * Contagens do início. "A revisar" é um count no banco; "incompletos" depende da regra de
 * completude (validação de CPF/CNPJ), calculada em JS sobre apenas as colunas que ela usa,
 * paginadas pelo limite do PostgREST.
 */
export async function resumoPendencias(): Promise<{ aRevisar: number; incompletos: number }> {
  const supabase = await createServerClient();
  const [revisar, data] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("situacao", "a_revisar"),
    buscarTodas<unknown>(
      (de, ate) =>
        supabase
          .from("clientes")
          .select("id, regime, email, documento, socios(administrador), contratos(situacao, honorario, dia_vencimento, carteira_id, tipo_cobranca, email_cobranca)")
          .neq("situacao", "inativo")
          .order("id")
          .range(de, ate) as never,
    ),
  ]);
  if (revisar.error) throw new Error(`Falha ao contar clientes a revisar: ${revisar.error.message}`);
  // montar() só precisa dessas colunas para pendenciasCadastro; o restante do tipo não é usado aqui.
  const todos = (data as unknown as Bruto[]).map(montar);
  return { aRevisar: revisar.count ?? 0, incompletos: todos.filter((c) => pendenciasCadastro(c).length > 0).length };
}
