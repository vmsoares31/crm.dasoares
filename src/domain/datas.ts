import type { Competencia, DataISO } from "./tipos";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function ultimoDia(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function dataVencimento(competencia: Competencia, dia: number | null): DataISO {
  const [a, m] = competencia.split("-").map(Number);
  const ult = ultimoDia(a, m);
  const d = dia === null || dia > ult ? ult : dia;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatarData(d: DataISO): string {
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

export function dataPorExtenso(d: DataISO): string {
  const [a, m, dia] = d.split("-").map(Number);
  return `${String(dia).padStart(2, "0")} de ${MESES[m - 1]} de ${a}`;
}

export function hojeSP(): DataISO {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
