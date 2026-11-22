import { cn } from "@/lib/utils";

/** Mensagem de retorno de formulário (erro ou sucesso), com o papel ARIA adequado. */
export function Mensagem({ tipo, className, children }: { tipo: "erro" | "ok"; className?: string; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={cn("text-sm font-medium", tipo === "erro" ? "text-destructive" : "text-success", className)}
    >
      {children}
    </p>
  );
}
