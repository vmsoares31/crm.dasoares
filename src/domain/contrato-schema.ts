import { z } from "zod";

import { parseBRL } from "./dinheiro";

const texto = z.string().trim();
const dinheiro = (obrigatorio = false) =>
  texto
    .refine((s) => (obrigatorio ? s !== "" : true), "Informe o valor.")
    .refine((s) => s === "" || /^[\sR$\d.,]+$/.test(s), "Valor inválido.")
    .transform((s) => (s === "" ? null : parseBRL(s)));

const parcelaSchema = z.object({
  mes: z.number(),
  valor: z.number(),
  forma: z.enum(["junto_mensalidade", "data_propria"]),
  dia: z.number().nullable(),
});

const parcelasJson = z.string().transform((s, ctx) => {
  if (s.trim() === "") return [];
  try {
    const r = z.array(parcelaSchema).safeParse(JSON.parse(s));
    if (r.success) return r.data;
  } catch {
    // cai no erro abaixo
  }
  ctx.addIssue({ code: "custom", message: "Parcelas inválidas." });
  return z.NEVER;
});

export const contratoSchema = z
  .object({
    situacao: z.enum(["em_negociacao", "fechado", "encerrado"], { error: "Situação inválida." }),
    honorario: dinheiro(),
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
