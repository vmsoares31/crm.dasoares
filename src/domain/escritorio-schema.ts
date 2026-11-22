import { z } from "zod";

import { parseBRL } from "./dinheiro";
import { cnpjValido, somenteDigitos } from "./documentos";

const texto = z.string().trim();

/** Percentual digitado ("2", "2,5") → número ≥ 0. */
const percentual = (max?: number) =>
  z
    .string()
    .trim()
    .min(1, "Informe o percentual.")
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(
      z
        .number({ error: "Percentual inválido." })
        .min(0, "O percentual não pode ser negativo.")
        .max(max ?? 1000, max ? `O percentual deve ser no máximo ${max}.` : "Percentual muito alto."),
    );

export const escritorioSchema = z.object({
  razao_social: texto.min(1, "Informe a razão social."),
  cnpj: texto
    .refine(cnpjValido, "CNPJ inválido.")
    .transform(somenteDigitos),
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  cidade: texto,
  uf: texto
    .toUpperCase()
    .refine((s) => s === "" || /^[A-Z]{2}$/.test(s), "UF deve ter 2 letras."),
  cep: texto
    .transform(somenteDigitos)
    .refine((s) => s === "" || s.length === 8, "CEP deve ter 8 dígitos."),
  telefone: texto,
  email: texto.refine((s) => s === "" || z.email().safeParse(s).success, "E-mail inválido."),
  inscricao_municipal: texto,
  responsavel_tecnico: texto,
  crc: texto,
  cidade_foro: texto,
  multa_pct: percentual(),
  juros_mes_pct: percentual(),
  nome_cobranca: texto.min(1, "Informe o nome da cobrança."),
  dia_vencimento_padrao: z
    .string()
    .trim()
    .transform(Number)
    .pipe(z.number().int("Dia inválido.").min(1, "Dia deve estar entre 1 e 31.").max(31, "Dia deve estar entre 1 e 31.")),
  indicacao_pct: percentual(100),
  notificar_em: texto,
});
export type EscritorioEntrada = z.infer<typeof escritorioSchema>;

export const carteiraSchema = z.object({
  nome: texto.min(1, "Informe o nome da carteira."),
  saida: z.enum(["csv_cora", "lista_manual"], { error: "Forma de saída inválida." }),
});

export const servicoExtraSchema = z.object({
  nome: texto.min(1, "Informe o nome do serviço."),
  valor: z
    .string()
    .trim()
    .min(1, "Informe o valor.")
    .transform(parseBRL)
    .pipe(z.number().int().min(0, "O valor não pode ser negativo.")),
});
