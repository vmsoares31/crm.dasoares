import "server-only";

import { buscarTodas } from "@/db/paginar";
import type { ContratoParaReajuste } from "@/domain/reajuste";
import { createServerClient } from "@/lib/supabase/server";

export type ContratoReajustavel = ContratoParaReajuste & { razaoSocial: string; legado: boolean };

/** Contratos não encerrados com honorário definido (inclui legados). */
export async function listarContratosReajustaveis(): Promise<ContratoReajustavel[]> {
  const supabase = await createServerClient();
  const linhas = await buscarTodas<{
    id: string; honorario: number | null; parcela_adicional_total: number; legado: boolean;
    cliente: { razao_social: string } | null;
    parcelas: { mes: number; valor: number; forma: string; dia: number | null }[] | null;
  }>((de, ate) =>
    supabase
      .from("contratos")
      .select("id, honorario, parcela_adicional_total, legado, cliente:clientes!inner(razao_social), parcelas:parcelas_adicionais(mes, valor, forma, dia)")
      .neq("situacao", "encerrado")
      .not("honorario", "is", null)
      .order("id")
      .range(de, ate) as unknown as PromiseLike<{ data: never; error: { message: string } | null }>,
  );
  return linhas
    .map((c) => ({
      id: c.id,
      honorario: c.honorario,
      parcela_adicional_total: c.parcela_adicional_total ?? 0,
      legado: c.legado,
      razaoSocial: c.cliente?.razao_social ?? "—",
      parcelas: [...(c.parcelas ?? [])]
        .sort((a, b) => a.mes - b.mes)
        .map((x) => ({ mes: x.mes, valor: x.valor, forma: x.forma as "junto_mensalidade" | "data_propria", dia: x.dia })),
    }))
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"));
}
