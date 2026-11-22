import { cn } from "@/lib/utils";

export type TomSelo = "sucesso" | "info" | "perigo" | "neutro" | "alerta";

const CLASSES_TOM: Record<TomSelo, string> = {
  sucesso: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  perigo: "bg-danger-soft text-danger",
  neutro: "bg-neutral-soft text-neutral",
  alerta: "bg-warning-soft text-warning",
};

/** Pílula colorida genérica. */
export function Selo({ tom = "neutro", className, children }: { tom?: TomSelo; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap",
        CLASSES_TOM[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

const SITUACOES = {
  paga: { rotulo: "Paga", tom: "sucesso" },
  emitida: { rotulo: "Emitida", tom: "info" },
  atrasada: { rotulo: "Atrasada", tom: "perigo" },
  prevista: { rotulo: "Prevista", tom: "neutro" },
  a_revisar: { rotulo: "A revisar", tom: "alerta" },
  ativo: { rotulo: "Ativo", tom: "sucesso" },
  inativo: { rotulo: "Inativo", tom: "neutro" },
} as const satisfies Record<string, { rotulo: string; tom: TomSelo }>;

export type Situacao = keyof typeof SITUACOES;

/** Selo de situação (cobranças e clientes): Paga, Emitida, Atrasada, Prevista, A revisar, Ativo, Inativo. */
export function SituacaoBadge({ situacao, rotulo, className }: { situacao: Situacao | (string & {}); rotulo?: string; className?: string }) {
  const s = SITUACOES[situacao as Situacao];
  return (
    <Selo tom={s?.tom ?? "neutro"} className={className}>
      {rotulo ?? s?.rotulo ?? situacao}
    </Selo>
  );
}
