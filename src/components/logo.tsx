import { cn } from "@/lib/utils";

/**
 * Marca do CRM. Provisória: quadrado com "DA" + nome. Para usar o arquivo de logo real,
 * troque apenas o conteúdo deste componente.
 */
export function Logo({ tom = "claro", className }: { tom?: "claro" | "escuro"; className?: string }) {
  const sobreMarca = tom === "claro";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-[10px] font-heading text-[13px] font-extrabold tracking-tight",
          sobreMarca ? "bg-white text-marca-escuro shadow-sm" : "bg-degrade-destaque text-white",
        )}
      >
        DA
      </span>
      <span className="leading-tight">
        <span className={cn("block font-heading text-base font-extrabold tracking-tight", sobreMarca ? "text-white" : "text-heading")}>
          D.A. Soares
        </span>
        <span
          className={cn(
            "block text-[10.5px] font-semibold tracking-[0.12em] uppercase",
            sobreMarca ? "text-sidebar-foreground/70" : "text-muted-foreground",
          )}
        >
          CRM
        </span>
      </span>
    </div>
  );
}
