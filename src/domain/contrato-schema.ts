import { z } from "zod";

import { parseBRL } from "./dinheiro";

const texto = z.string().trim();
const dinheiro = (obrigatorio = false) =>
  texto
    .refine((s) => (obrigatorio ? s !== "" : true), "Informe o valor.")
    .refine((s) => s === "" || /^[\sR$\d.,]+$/.test(s), "Valor inválido.")
    .transform((s) => (s === "" ? null : parseBRL(s)));

type ParcelaBruta = { id?: string; mes: number; valor: number; forma: "junto_mensalidade" | "data_propria"; dia: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida cada parcela e aponta qual delas (e qual campo) está errada. */
function erroDaParcela(p: unknown): string | null {
  if (typeof p !== "object" || p === null) return "inválida";
  const o = p as Record<string, unknown>;
  if (o.id !== undefined && (typeof o.id !== "string" || !UUID.test(o.id))) return "identificador inválido";
  if (typeof o.mes !== "number" || !Number.isInteger(o.mes) || o.mes < 1 || o.mes > 12) return "mês inválido";
  if (typeof o.valor !== "number" || !Number.isInteger(o.valor) || o.valor <= 0) return "valor inválido";
  if (o.forma !== "junto_mensalidade" && o.forma !== "data_propria") return "vencimento inválido";
  if (o.dia !== null && (typeof o.dia !== "number" || !Number.isInteger(o.dia) || o.dia < 1 || o.dia > 31)) return "dia inválido";
  return null;
}

const parcelasJson = z.string().transform((s, ctx): ParcelaBruta[] => {
  if (s.trim() === "") return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(s);
  } catch {
    bruto = null;
  }
  if (!Array.isArray(bruto)) {
    ctx.addIssue({ code: "custom", message: "Parcelas inválidas." });
    return z.NEVER;
  }
  const ids = new Set<string>();
  const parcelas: ParcelaBruta[] = [];
  for (let i = 0; i < bruto.length; i++) {
    let erro = erroDaParcela(bruto[i]);
    const p = bruto[i] as ParcelaBruta;
    if (!erro && p.id !== undefined && ids.has(p.id.toLowerCase())) erro = "identificador inválido";
    if (erro) {
      ctx.addIssue({ code: "custom", message: `Parcela ${i + 1}: ${erro}.` });
      return z.NEVER;
    }
    if (p.id !== undefined) ids.add(p.id.toLowerCase());
    // id presente = parcela existente (atualizada no lugar); ausente = parcela nova.
    parcelas.push({ ...(p.id !== undefined ? { id: p.id } : {}), mes: p.mes, valor: p.valor, forma: p.forma, dia: p.dia });
  }
  return parcelas;
});

export const contratoSchema = z
  .object({
    situacao: z.enum(["em_negociacao", "fechado", "encerrado"], { error: "Situação inválida." }),
    honorario: dinheiro().refine((n) => n === null || n > 0, "Informe um honorário maior que zero."),
    dia_vencimento: texto
      .transform((s) => (s === "" ? null : Number(s)))
      .refine((n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 31), "Dia deve estar entre 1 e 31."),
    data_inicio: texto
      .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s), "Data inválida.")
      .transform((s) => s || null),
    carteira_id: texto.transform((s) => s || null),
    tipo_cobranca: z
      .enum(["", "boleto", "boleto_pix", "pix", "cartao"], { error: "Tipo de cobrança inválido." })
      .transform((s) => s || null),
    email_cobranca: texto
      .refine((s) => s === "" || z.email().safeParse(s).success, "E-mail inválido.")
      .transform((s) => s || null),
    parcela_adicional_total: dinheiro().transform((n) => n ?? 0),
    legado: z.boolean(),
    encerrado_em: texto
      .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s), "Data inválida.")
      .transform((s) => s || null),
    motivo: texto.transform((s) => s || null),
    parcelas: parcelasJson,
  })
  .superRefine((v, ctx) => {
    if (v.situacao === "encerrado" && !v.encerrado_em) {
      ctx.addIssue({ code: "custom", path: ["encerrado_em"], message: "Informe a data de encerramento." });
    }
  });

export type DadosContrato = z.output<typeof contratoSchema>;
