import { cnpjValido, cpfValido, somenteDigitos } from "./documentos";
import type { DataISO } from "./tipos";

export type SocioImportado = {
  cpf: string;
  nome: string;
  participacao: number;
  saida: DataISO | null;
};

export type EmpresaImportada = {
  codigo: number;
  razaoSocial: string;
  nomeFantasia: string;
  documento: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  situacao: "Ativa" | "Inativa" | null;
  socios: SocioImportado[];
  camposSuspeitos: string[];
};

/** Separa o texto do `pdftotext -layout` em uma página por empresa. */
export function dividirPaginas(texto: string): string[] {
  return texto
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .split(/^(?=Empresa:)/m)
    .filter((p) => p.startsWith("Empresa:"));
}

const COLUNA_VALOR = 25; // os valores da coluna esquerda começam sempre na coluna 25
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Remove o "1" parasita colado ao rótulo (ele ocupa o lugar de um espaço). */
function limparPrefixo(linha: string): string {
  return /^1[A-Za-zÀ-ú]/.test(linha) ? " " + linha.slice(1) : linha;
}

function dataISO(s: string): DataISO | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m || m[3] === "0000") return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseSocio(linha: string): SocioImportado | null {
  const re =
    /^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+\d+\s*-\s*(.+?)\s{2,}([\d.,]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s*$/;
  // O "1" parasita pode colar no CPF; o formato com pontuação torna a tentativa direta inequívoca.
  const m = re.exec(linha) ?? re.exec(linha.replace(/^1/, ""));
  if (!m) return null;
  return {
    cpf: somenteDigitos(m[1]),
    nome: m[2].trim(),
    participacao: Number(m[3].replace(/\./g, "").replace(",", ".")),
    saida: dataISO(m[5]),
  };
}

export function parsePaginaDominio(texto: string): EmpresaImportada {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const iSocios = linhas.findIndex((l) => l.includes("QUADRO SOCIETÁRIO"));
  const cadastro = (iSocios >= 0 ? linhas.slice(0, iSocios) : linhas).map(limparPrefixo);

  // Início da coluna direita (desalinhada): ignorada, exceto a situação.
  const linhaCodigo = cadastro.find((l) => /^\s*Código:/.test(l)) ?? "";
  const fimEsq = linhaCodigo.indexOf("Data da inscrição:");
  const campo = (rotulo: string): string => {
    const l = cadastro.find((x) => x.trimStart().startsWith(rotulo + ":") && x.indexOf(rotulo + ":") <= 1);
    if (!l) return "";
    return (fimEsq > 0 ? l.slice(COLUNA_VALOR, fimEsq) : l.slice(COLUNA_VALOR).split(/\s{2,}/)[0]).trim();
  };

  const suspeitos: string[] = [];

  const situacaoLinha = cadastro.find((l) => /\s(Ativa|Inativa)\s*$/.test(l));
  const situacao = situacaoLinha ? (/Inativa\s*$/.test(situacaoLinha) ? "Inativa" : "Ativa") : null;

  // Documento: campo CNPJ/CPF; se estiver deslocado, cai para o C.N.P.J. do cabeçalho.
  const cabecalho = /C\.N\.P\.J\.:\s*([\d./-]+)/.exec(texto)?.[1] ?? "";
  let documento = "";
  for (const cand of [campo("CNPJ/CPF/CEI/CAEPF"), cabecalho]) {
    const d = somenteDigitos(cand);
    if (cnpjValido(d) || cpfValido(d)) {
      documento = d;
      break;
    }
  }
  if (!documento) suspeitos.push("documento");

  let email = campo("E-mail");
  if (email && !EMAIL_RE.test(email)) {
    email = "";
    suspeitos.push("email");
  }

  let cep = somenteDigitos(campo("CEP"));
  let enderecoSuspeito = false;
  if (cep.length !== 8) {
    suspeitos.push("cep");
    enderecoSuspeito = true;
    cep = "";
  }
  let uf = campo("UF");
  if (!/^[A-Z]{2}$/.test(uf)) {
    suspeitos.push("uf");
    enderecoSuspeito = true;
    uf = "";
  }
  // Valores deslocados quando há campos em branco: o bloco inteiro de endereço não é confiável.
  if (enderecoSuspeito) suspeitos.push("endereco");
  const razaoSocial = campo("Razão social");
  if (!razaoSocial) suspeitos.push("razao_social");

  const tipo = campo("Tipo de endereço");
  const endereco = campo("Endereço");

  const checarIe = (nome: string, valor: string): string => {
    const d = somenteDigitos(valor);
    if (valor && (valor.includes("@") || (d.length >= 11 && d === documento))) {
      suspeitos.push(nome);
      return "";
    }
    return valor;
  };

  const socios: SocioImportado[] = [];
  if (iSocios >= 0) {
    for (const l of linhas.slice(iSocios)) {
      const s = parseSocio(l);
      if (!s) continue;
      if (!cpfValido(s.cpf) && !cnpjValido(s.cpf)) {
        if (!suspeitos.includes("socio_cpf")) suspeitos.push("socio_cpf");
      }
      socios.push(s);
    }
  }

  return {
    codigo: Number(campo("Código")) || 0,
    razaoSocial: razaoSocial || campo("Nome"),
    nomeFantasia: campo("Nome fantasia"),
    documento,
    logradouro: [tipo, endereco].filter(Boolean).join(" "),
    numero: campo("Número"),
    complemento: campo("Complemento"),
    bairro: campo("Bairro"),
    cidade: campo("Município"),
    uf,
    cep,
    telefone: campo("Telefone"),
    email,
    inscricaoEstadual: checarIe("inscricao_estadual", campo("Insc. estadual")),
    inscricaoMunicipal: checarIe("inscricao_municipal", campo("Insc. municipal")),
    situacao,
    socios,
    camposSuspeitos: suspeitos,
  };
}
