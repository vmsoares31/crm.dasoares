import Link from "next/link";

import { TelaAcesso } from "@/components/layout/tela-acesso";
import { buttonVariants } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <TelaAcesso>
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold">Acesso negado (403)</h1>
          <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
        <Link href="/inicio" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Voltar ao início
        </Link>
      </div>
    </TelaAcesso>
  );
}
