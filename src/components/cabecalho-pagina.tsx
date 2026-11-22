import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/** Cabeçalho padrão das telas: link de volta opcional, título, descrição e ações à direita. */
export function CabecalhoPagina({
  titulo,
  descricao,
  voltar,
  acoes,
  className,
  children,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  voltar?: { href: string; rotulo: string };
  acoes?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      {voltar && (
        <Link href={voltar.href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading">
          <ChevronLeft className="size-4" aria-hidden />
          {voltar.rotulo}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-heading">{titulo}</h1>
          {children}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
      {descricao && <p className="max-w-3xl text-sm text-muted-foreground">{descricao}</p>}
    </header>
  );
}
