import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, Table2, TriangleAlert, Users } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { resumoPendencias } from "@/db/clientes";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";

const ATALHOS = [
  { href: "/clientes", titulo: "Clientes", texto: "Lista, filtros e ficha de cada cliente", icone: Users },
  { href: "/clientes/edicao-em-massa", titulo: "Edição em massa", texto: "Honorários, vencimentos e carteiras", icone: Table2, massa: true },
  { href: "/escritorio", titulo: "Escritório", texto: "Dados da contratada e parâmetros", icone: Building2 },
];

export default async function InicioPage() {
  const [usuario, resumo] = await Promise.all([usuarioAtual(), resumoPendencias()]);
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0] ?? "";
  const podeMassa = !!usuario && pode(usuario.permissoes, "clientes.editar") && pode(usuario.permissoes, "contratos.editar");
  const atalhos = ATALHOS.filter((a) => !a.massa || podeMassa);
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <div className="space-y-8">
      <CabecalhoPagina titulo={primeiroNome ? `Olá, ${primeiroNome}` : "Início"} descricao={<span className="first-letter:uppercase">{hoje}</span>} />

      <section aria-label="Resumo dos cadastros" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/clientes?situacao=a_revisar"
          className="group rounded-xl bg-degrade-destaque p-5 text-white shadow-card transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex items-center justify-between text-sm font-medium text-white/85">
            Clientes a revisar
            <ClipboardList className="size-5 text-white/80" aria-hidden />
          </span>
          <strong className="mt-2 block font-heading text-3xl font-extrabold tabular-nums">{resumo.aRevisar}</strong>
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/80">
            Vindos da importação, aguardando conferência
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
        <Link href="/clientes?pendencias=1" className="group outline-none">
          <Card className="h-full px-5 transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
            <span className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              Cadastros incompletos
              <TriangleAlert className="size-5 text-warning" aria-hidden />
            </span>
            <strong className="block font-heading text-3xl font-extrabold text-heading tabular-nums">{resumo.incompletos}</strong>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              Clientes ativos ou a revisar com pendências
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Card>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-[0.08em] text-muted-foreground uppercase">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map(({ href, titulo, texto, icone: Icone }) => (
            <Link key={href} href={href} className="group outline-none">
              <Card size="sm" className="h-full flex-row items-center gap-4 px-4 transition-colors group-hover:bg-muted group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icone className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-heading">{titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{texto}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
