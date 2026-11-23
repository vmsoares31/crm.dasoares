"use server";

import { revalidatePath } from "next/cache";

import { obterContrato } from "@/db/contratos";
import { listarServicosExtras } from "@/db/servicos-extras";
import { contratoElegivel, parsePercentual, reajustarTabelaExtras, reproporcionarParcelas, validarLimiteReajuste } from "@/domain/reajuste";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export type FalhaLinha = { id: string; nome: string; erro: string };
export type ResultadoReajuste = { erro?: string; aplicados?: number; falhas?: FalhaLinha[] };
export type ItemReajuste = { contratoId: string; honorarioPara: number; parcelaPara: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSG = "Não foi possível concluir a operação. Tente novamente.";

async function autorizar(): Promise<string | null> {
  try {
    await exigirPermissao("reajuste.aplicar");
    return null;
  } catch (e) {
    return e instanceof SemPermissaoError
      ? "Você não tem permissão para aplicar o reajuste."
      : "Não foi possível verificar suas permissões. Tente novamente.";
  }
}

/** Aplica o reajuste contrato a contrato (cada um atômico, via salvar_contrato); falhas não abortam o lote. */
export async function aplicarReajusteContratos(pctTexto: string, itens: ItemReajuste[]): Promise<ResultadoReajuste> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const pct = parsePercentual(pctTexto);
  if (pct === null) return { erro: "Informe um percentual entre 0 e 100." };
  if (!Array.isArray(itens) || itens.length === 0) return { erro: "Nenhum contrato selecionado." };

  const supabase = await createServerClient();
  const falhas: FalhaLinha[] = [];
  let aplicados = 0;
  const motivo = `Reajuste anual ${String(pct).replace(".", ",")}%`;

  for (const it of itens) {
    if (typeof it.contratoId !== "string" || !UUID.test(it.contratoId)) {
      falhas.push({ id: String(it.contratoId), nome: "Contrato desconhecido", erro: "Identificador inválido." });
      continue;
    }
    let nome = "Contrato desconhecido";
    try {
      const c = await obterContrato(it.contratoId);
      if (!c) { falhas.push({ id: it.contratoId, nome, erro: "Contrato não encontrado." }); continue; }
      nome = c.cliente.razao_social;
      if (!contratoElegivel(c.situacao, c.honorario)) {
        falhas.push({ id: c.id, nome, erro: c.situacao === "encerrado" ? "Contrato encerrado." : "Contrato sem honorário definido." });
        continue;
      }
      const temParcelas = c.parcelas.length > 0;
      // Sem linhas de parcela, o total fica como está (ignora o valor enviado).
      const parcelaPara = temParcelas ? it.parcelaPara : c.parcela_adicional_total;
      const erroLimite =
        validarLimiteReajuste(c.honorario as number, it.honorarioPara, "Honorário")
        ?? (temParcelas ? validarLimiteReajuste(c.parcela_adicional_total, parcelaPara, "Parcela adicional") : null);
      if (erroLimite) { falhas.push({ id: c.id, nome, erro: erroLimite }); continue; }
      const parcelas = reproporcionarParcelas(
        // id da parcela: salvar_contrato atualiza no lugar (cobranças já geradas continuam vinculadas)
        c.parcelas.map((p) => ({ id: p.id, mes: p.mes, valor: p.valor, forma: p.forma as "junto_mensalidade" | "data_propria", dia: p.dia })),
        parcelaPara,
      );
      const campos = {
        situacao: c.situacao, honorario: it.honorarioPara, dia_vencimento: c.dia_vencimento, data_inicio: c.data_inicio,
        carteira_id: c.carteira_id, tipo_cobranca: c.tipo_cobranca, email_cobranca: c.email_cobranca,
        parcela_adicional_total: parcelaPara, legado: c.legado, encerrado_em: c.encerrado_em,
      };
      const { error } = await supabase.rpc("salvar_contrato", { p_contrato_id: c.id, p_campos: campos, p_parcelas: parcelas.map((x) => ({ ...x })), p_motivo: motivo });
      if (error) {
        console.error("[reajuste] contrato", c.id, error.message);
        falhas.push({ id: c.id, nome, erro: error.code === "22023" ? error.message : MSG });
        continue;
      }
      aplicados++;
      try {
        await registrarAuditoria("contrato.reajuste", "contratos", c.id, {
          pct, honorario_de: c.honorario, honorario_para: it.honorarioPara,
          parcela_de: c.parcela_adicional_total, parcela_para: parcelaPara,
        });
      } catch (e) {
        console.error("[reajuste] auditoria", c.id, e);
      }
    } catch (e) {
      console.error("[reajuste] contrato", it.contratoId, e);
      falhas.push({ id: it.contratoId, nome, erro: MSG });
    }
  }
  revalidatePath("/contratos");
  revalidatePath("/escritorio/reajuste");
  return { aplicados, falhas };
}

/** Reajusta todos os serviços extras pelo percentual, arredondando para cima ao real. */
export async function aplicarReajusteExtras(pctTexto: string): Promise<ResultadoReajuste> {
  const negado = await autorizar();
  if (negado) return { erro: negado };
  const pct = parsePercentual(pctTexto);
  if (pct === null) return { erro: "Informe um percentual entre 0 e 100." };

  const servicos = await listarServicosExtras();
  const nomes = new Map(servicos.map((s) => [s.id, s.nome]));
  const supabase = await createServerClient();
  const falhas: FalhaLinha[] = [];
  let aplicados = 0;
  for (const r of reajustarTabelaExtras(servicos, pct)) {
    if (r.para === r.de) continue;
    const { error } = await supabase.from("servicos_extras").update({ valor: r.para }).eq("id", r.id);
    if (error) {
      console.error("[reajuste] extra", r.id, error.message);
      falhas.push({ id: r.id, nome: nomes.get(r.id) ?? r.id, erro: MSG });
      continue;
    }
    aplicados++;
    try {
      await registrarAuditoria("servico_extra.reajuste", "servicos_extras", r.id, { pct, de: r.de, para: r.para });
    } catch (e) {
      console.error("[reajuste] auditoria", r.id, e);
    }
  }
  revalidatePath("/escritorio/servicos-extras");
  revalidatePath("/escritorio/reajuste");
  return { aplicados, falhas };
}
