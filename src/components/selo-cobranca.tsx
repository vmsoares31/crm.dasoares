import { Selo, type TomSelo } from "@/components/situacao-badge";

export const SITUACOES_COBRANCA: Record<string, { rotulo: string; tom: TomSelo }> = {
  prevista: { rotulo: "Prevista", tom: "neutro" },
  emitida: { rotulo: "Emitida", tom: "info" },
  paga: { rotulo: "Paga", tom: "sucesso" },
  paga_parcial: { rotulo: "Paga parcialmente", tom: "alerta" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
  quitada_por_credito: { rotulo: "Quitada por crédito", tom: "sucesso" },
};

/** Selo da situação de uma cobrança; "Atrasada" e "Saldo dispensado" são derivados. */
export function SeloCobranca({ situacao, atrasada, saldoDispensado }: { situacao: string; atrasada?: boolean; saldoDispensado?: boolean }) {
  if (atrasada) return <Selo tom="perigo">Atrasada</Selo>;
  if (situacao === "paga_parcial" && saldoDispensado) return <Selo tom="neutro">Parcial · saldo dispensado</Selo>;
  const s = SITUACOES_COBRANCA[situacao] ?? { rotulo: situacao, tom: "neutro" as TomSelo };
  return <Selo tom={s.tom}>{s.rotulo}</Selo>;
}
