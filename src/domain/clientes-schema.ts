import { z } from "zod";

import { parseBRL } from "./dinheiro";
import { cnpjValido, cpfValido, somenteDigitos } from "./documentos";

const texto = z.string().trim();
const opcional = texto.transform((s) => (s === "" ? null : s));
const nulavel = (s: string) => (s === "" ? null : s);

const REGIMES = ["mei", "simples_nacional", "lucro_presumido", "lucro_real"] as const;
const TIPOS = ["boleto", "boleto_pix", "pix", "cartao"] as const;

const regimeOpcional = texto
  .refine((s) => s === "" || (REGIMES as readonly string[]).includes(s), "Regime inválido.")
  .transform(nulavel);
const emailOpcional = texto
  .refine((s) => s === "" || z.email().safeParse(s).success, "E-mail inválido.")
  .transform(nulavel);

export const clienteSchema = z.object({
  razao_social: texto.min(1, "Informe a razão social."),
  nome_fantasia: opcional,
  documento: texto
    .transform(somenteDigitos)
    .refine((d) => d === "" || cpfValido(d) || cnpjValido(d), "CPF/CNPJ inválido.")
    .transform(nulavel),
  codigo_dominio: texto
    .refine((s) => s === "" || /^\d{1,9}$/.test(s), "Código do Domínio inválido.")
    .transform((s) => (s === "" ? null : Number(s))),
  logradouro: opcional,
  numero: opcional,
  complemento: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: texto
    .toUpperCase()
    .refine((s) => s === "" || /^[A-Z]{2}$/.test(s), "UF deve ter 2 letras.")
    .transform(nulavel),
  cep: texto
    .transform(somenteDigitos)
    .refine((s) => s === "" || s.length === 8, "CEP deve ter 8 dígitos.")
    .transform(nulavel),
  telefone: opcional,
  email: emailOpcional,
  inscricao_estadual: opcional,
  inscricao_municipal: opcional,
  regime: regimeOpcional,
  indicado_por: texto.transform(nulavel),
  observacoes: opcional,
});
export type ClienteEntrada = z.infer<typeof clienteSchema>;

export const socioSchema = z.object({
  nome: texto.min(1, "Informe o nome do sócio."),
  cpf: texto
    .transform(somenteDigitos)
    .refine((d) => d === "" || cpfValido(d), "CPF do sócio inválido.")
    .transform(nulavel),
  participacao: texto
    .transform((s) => s.replace(",", "."))
    .refine(
      (s) => s === "" || (!Number.isNaN(Number(s)) && Number(s) >= 0 && Number(s) <= 100),
      "Participação deve estar entre 0 e 100.",
    )
    .transform((s) => (s === "" ? null : Number(s))),
  administrador: z.boolean(),
});
export type SocioEntrada = z.infer<typeof socioSchema>;

/** Linha da edição em massa (campos como digitados). */
export const linhaMassaSchema = z.object({
  clienteId: z.uuid("Cliente inválido."),
  regime: regimeOpcional,
  honorario: texto
    .refine((s) => s === "" || /\d/.test(s), "Honorário inválido.")
    .transform((s) => (s === "" ? null : parseBRL(s)))
    .refine((v) => v === null || v >= 0, "Honorário não pode ser negativo."),
  dia_vencimento: texto
    .refine((s) => s === "" || (/^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= 31), "Dia deve estar entre 1 e 31.")
    .transform((s) => (s === "" ? null : Number(s))),
  carteira_id: texto.transform(nulavel),
  tipo_cobranca: texto
    .refine((s) => s === "" || (TIPOS as readonly string[]).includes(s), "Tipo de cobrança inválido.")
    .transform(nulavel),
  email_cobranca: emailOpcional,
});
export type LinhaMassa = z.infer<typeof linhaMassaSchema>;
