import type { Tables } from "@/db/database.types";

import { cnpjValido, cpfValido } from "./documentos";

export type Cliente = Tables<"clientes">;
export type Socio = Tables<"socios">;
export type Contrato = Tables<"contratos">;

export type Pendencia =
  | "honorario"
  | "vencimento"
  | "regime"
  | "carteira"
  | "tipo_cobranca"
  | "socio_administrador"
  | "email"
  | "documento_invalido";

export type ClienteCompleto = Cliente & { socios: Socio[]; contrato: Contrato | null };

export const ROTULOS_PENDENCIA: Record<Pendencia, string> = {
  honorario: "Sem honorário",
  vencimento: "Sem dia de vencimento",
  regime: "Sem regime tributário",
  carteira: "Sem carteira",
  tipo_cobranca: "Sem tipo de cobrança",
  socio_administrador: "Sem sócio administrador",
  email: "Sem e-mail",
  documento_invalido: "CPF/CNPJ inválido",
};

function documentoValido(doc: string | null): boolean {
  const d = (doc ?? "").replace(/\D/g, "");
  return (d.length === 11 && cpfValido(d)) || (d.length === 14 && cnpjValido(d));
}

export function pendenciasCadastro(c: ClienteCompleto): Pendencia[] {
  const p: Pendencia[] = [];
  const k = c.contrato;
  if (k?.honorario == null) p.push("honorario");
  if (k?.dia_vencimento == null) p.push("vencimento");
  if (!c.regime) p.push("regime");
  if (!k?.carteira_id) p.push("carteira");
  if (!k?.tipo_cobranca) p.push("tipo_cobranca");
  if (!c.socios.some((s) => s.administrador)) p.push("socio_administrador");
  if (!c.email?.trim() && !k?.email_cobranca?.trim()) p.push("email");
  if (!documentoValido(c.documento)) p.push("documento_invalido");
  return p;
}
