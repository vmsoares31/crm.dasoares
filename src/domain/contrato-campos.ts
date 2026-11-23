import type { Tables } from "@/db/database.types";

import type { ClienteCompleto } from "./completude";
import { dataPorExtenso, formatarData } from "./datas";
import { formatarBRL } from "./dinheiro";
import { formatarDocumento, somenteDigitos } from "./documentos";
import { valorPorExtenso } from "./extenso";
import { textoParcelaAdicional } from "./parcelas";
import { ROTULOS_REGIME } from "./rotulos";
import type { DataISO, ParcelaAdicional, Regime } from "./tipos";

type Escritorio = Tables<"escritorio">;
type Contrato = Tables<"contratos">;

/** Campos do cadastro do escritório usados no contrato. */
export type EscritorioContrato = Pick<
  Escritorio,
  | "razao_social" | "cnpj" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "cep"
  | "responsavel_tecnico" | "crc" | "cidade_foro"
>;

/** Valores das tags do modelo de contrato (templates/contrato-padrao.docx). */
export type CamposContrato = {
  contratante_razao: string;
  /** "CNPJ" ou "CPF", conforme o documento do contratante. */
  rotulo_documento: "CNPJ" | "CPF";
  contratante_cnpj: string;
  contratante_endereco: string;
  contratante_bairro: string;
  contratante_cidade: string;
  contratante_uf: string;
  contratante_cep: string;
  contratante_email: string;
  contratante_telefone: string;
  socio_admin_nome: string;
  socio_admin_cpf: string;
  contratada_razao: string;
  contratada_cnpj: string;
  contratada_endereco: string;
  contratada_bairro: string;
  contratada_cidade: string;
  contratada_uf: string;
  contratada_cep: string;
  responsavel_tecnico: string;
  crc: string;
  regime: string;
  honorario: string;
  honorario_extenso: string;
  dia_vencimento: string;
  texto_parcela_adicional: string;
  /** Seção condicional das cláusulas 4.7/4.7.1. */
  tem_parcela_adicional: boolean;
  data_inicio: string;
  cidade_foro: string;
  data_contrato_extenso: string;
};

function endereco(logradouro: string | null, numero: string | null, complemento: string | null): string {
  return [logradouro, numero, complemento].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
}

function cep(s: string | null): string {
  const d = somenteDigitos(s ?? "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (s ?? "").trim();
}

const t = (s: string | null | undefined) => (s ?? "").trim();

/** Campos do escritório sem os quais o contrato sairia com a qualificação da CONTRATADA errada. */
function faltandoNoEscritorio(e: EscritorioContrato): string[] {
  const f: string[] = [];
  if (!t(e.razao_social)) f.push("razão social");
  if (!somenteDigitos(e.cnpj ?? "")) f.push("CNPJ");
  if (!endereco(e.logradouro, e.numero, e.complemento)) f.push("endereço");
  if (!t(e.cidade) || !t(e.uf)) f.push("cidade/UF");
  if (!t(e.responsavel_tecnico)) f.push("responsável técnico");
  if (!t(e.crc)) f.push("CRC");
  return f;
}

/** Monta os campos do contrato; lança erro (mensagem para o usuário) se faltar dado essencial. */
export function camposContrato(
  escritorio: EscritorioContrato,
  cliente: ClienteCompleto,
  contrato: Contrato,
  parcelas: ParcelaAdicional[],
  hoje: DataISO,
): CamposContrato {
  const socio = cliente.socios.find((s) => s.administrador);
  if (!socio) throw new Error("Cliente sem sócio administrador");
  if (!cliente.regime || !(cliente.regime in ROTULOS_REGIME)) throw new Error("Cliente sem regime tributário");
  if (contrato.honorario == null) throw new Error("Contrato sem honorário");
  if (contrato.dia_vencimento == null) throw new Error("Contrato sem dia de vencimento");
  if (!contrato.data_inicio) throw new Error("Contrato sem data de início");
  const faltaEscritorio = faltandoNoEscritorio(escritorio);
  if (faltaEscritorio.length > 0) throw new Error(`Cadastro do escritório incompleto: ${faltaEscritorio.join(", ")}`);

  return {
    contratante_razao: t(cliente.razao_social),
    rotulo_documento: somenteDigitos(cliente.documento ?? "").length === 11 ? "CPF" : "CNPJ",
    contratante_cnpj: formatarDocumento(cliente.documento ?? ""),
    contratante_endereco: endereco(cliente.logradouro, cliente.numero, cliente.complemento),
    contratante_bairro: t(cliente.bairro),
    contratante_cidade: t(cliente.cidade),
    contratante_uf: t(cliente.uf),
    contratante_cep: cep(cliente.cep),
    contratante_email: t(cliente.email) || t(contrato.email_cobranca),
    contratante_telefone: t(cliente.telefone),
    socio_admin_nome: t(socio.nome),
    socio_admin_cpf: socio.cpf ? formatarDocumento(socio.cpf) : "",
    contratada_razao: t(escritorio.razao_social),
    contratada_cnpj: formatarDocumento(escritorio.cnpj),
    contratada_endereco: endereco(escritorio.logradouro, escritorio.numero, escritorio.complemento),
    contratada_bairro: t(escritorio.bairro),
    contratada_cidade: t(escritorio.cidade),
    contratada_uf: t(escritorio.uf),
    contratada_cep: cep(escritorio.cep),
    responsavel_tecnico: t(escritorio.responsavel_tecnico),
    crc: t(escritorio.crc),
    regime: ROTULOS_REGIME[cliente.regime as Regime],
    honorario: formatarBRL(contrato.honorario),
    honorario_extenso: valorPorExtenso(contrato.honorario),
    dia_vencimento: String(contrato.dia_vencimento),
    texto_parcela_adicional: textoParcelaAdicional(parcelas, contrato.dia_vencimento),
    tem_parcela_adicional: parcelas.length > 0,
    data_inicio: formatarData(contrato.data_inicio),
    cidade_foro: t(escritorio.cidade_foro) || t(escritorio.cidade),
    data_contrato_extenso: dataPorExtenso(hoje),
  };
}
