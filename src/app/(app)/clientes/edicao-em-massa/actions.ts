"use server";

import { revalidatePath } from "next/cache";

import { upsertContratoLegado } from "@/db/contratos";
import { linhaMassaSchema } from "@/domain/clientes-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type LinhaEntrada = {
  clienteId: string;
  regime: string;
  honorario: string;
  dia_vencimento: string;
  carteira_id: string;
  tipo_cobranca: string;
  email_cobranca: string;
};

export type ResultadoMassa = {
  erro?: string;
  salvos?: number;
  erros?: { clienteId: string; mensagem: string }[];
};

export async function salvarEdicaoEmMassa(linhas: LinhaEntrada[]): Promise<ResultadoMassa> {
  try {
    await exigirPermissao("clientes.editar");
    await exigirPermissao("contratos.editar");
  } catch (e) {
    return {
      erro: e instanceof SemPermissaoError
        ? "Você não tem permissão para editar clientes e contratos."
        : "Não foi possível verificar suas permissões. Tente novamente.",
    };
  }
  if (!Array.isArray(linhas) || linhas.length === 0) return { erro: "Nenhuma alteração para salvar." };
  if (linhas.length > 500) return { erro: "Muitas linhas de uma vez. Salve em lotes menores." };

  const supabase = await createServerClient();
  const erros: { clienteId: string; mensagem: string }[] = [];
  let salvos = 0;

  for (const bruta of linhas) {
    const clienteId = String(bruta?.clienteId ?? "");
    const r = linhaMassaSchema.safeParse(bruta);
    if (!r.success) {
      erros.push({ clienteId, mensagem: r.error.issues.map((i) => i.message).join(" ") });
      continue;
    }
    const { regime, honorario, dia_vencimento, carteira_id, tipo_cobranca, email_cobranca } = r.data;
    const contrato = { honorario, dia_vencimento, carteira_id, tipo_cobranca, email_cobranca };
    try {
      const { error } = await supabase.from("clientes").update({ regime }).eq("id", clienteId);
      if (error) throw new Error(error.message);
      const k = await upsertContratoLegado(clienteId, contrato);
      await registrarAuditoria("contrato.edicao_em_massa", "contratos", k.id, {
        cliente_id: clienteId, regime, ...contrato, criado: k.criado,
      });
      salvos++;
    } catch (e) {
      console.error(`[clientes] edicao em massa ${clienteId}:`, e instanceof Error ? e.message : e);
      erros.push({ clienteId, mensagem: "Não foi possível salvar esta linha." });
    }
  }
  revalidatePath("/clientes");
  revalidatePath("/clientes/edicao-em-massa");
  return { salvos, erros };
}
