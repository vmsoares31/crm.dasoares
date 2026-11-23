"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  ChartColumn,
  CircleAlert,
  CirclePlus,
  FileText,
  HeartHandshake,
  House,
  LogOut,
  Menu,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { sair } from "@/app/(auth)/login/actions";
import { Logo } from "@/components/logo";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Item = { href: string; rotulo: string; icone: LucideIcon; somenteGestorUsuarios?: boolean };
type Grupo = { rotulo?: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    itens: [
      { href: "/inicio", rotulo: "Início", icone: House },
      { href: "/clientes", rotulo: "Clientes", icone: Users },
      { href: "/contratos", rotulo: "Contratos", icone: FileText },
      { href: "/extras", rotulo: "Extras", icone: CirclePlus },
      { href: "/indicacoes", rotulo: "Indicações", icone: HeartHandshake },
    ],
  },
  {
    rotulo: "Financeiro",
    itens: [
      { href: "/financeiro", rotulo: "Painel do mês", icone: ChartColumn },
      { href: "/financeiro/inadimplencia", rotulo: "Inadimplência", icone: CircleAlert },
    ],
  },
  {
    rotulo: "Configurações",
    itens: [
      { href: "/escritorio", rotulo: "Escritório", icone: Building2 },
      { href: "/usuarios", rotulo: "Usuários", icone: UserCog, somenteGestorUsuarios: true },
    ],
  },
];

const HREFS = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));

export type UsuarioMenu = { nome: string; papel: string; mostrarUsuarios: boolean };

const ROTULO_PAPEL: Record<string, string> = { administrador: "Administrador", colaborador: "Colaborador" };

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : (partes[0][1] ?? "");
  return (primeira + ultima).toUpperCase();
}

function ConteudoMenu({ usuario, aoNavegar }: { usuario: UsuarioMenu; aoNavegar?: () => void }) {
  const caminho = usePathname();
  const casa = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
  // o item mais específico vence (ex.: /financeiro/inadimplencia não acende /financeiro)
  const ativo = (href: string) =>
    casa(href) && !HREFS.some((h) => h.length > href.length && h.startsWith(`${href}/`) && casa(h));

  return (
    <div className="flex h-full flex-col gap-6 px-4 pt-6 pb-4 text-sidebar-foreground">
      <Link href="/inicio" onClick={aoNavegar} className="rounded-lg px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
        <Logo />
      </Link>

      <nav aria-label="Menu principal" className="-mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1 text-sm">
        {GRUPOS.map((g, i) => {
          const itens = g.itens.filter((it) => !it.somenteGestorUsuarios || usuario.mostrarUsuarios);
          if (itens.length === 0) return null;
          return (
            <div key={g.rotulo ?? i} className="flex flex-col gap-0.5">
              {g.rotulo && (
                <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold tracking-[0.12em] text-sidebar-foreground/60 uppercase">
                  {g.rotulo}
                </p>
              )}
              {itens.map(({ href, rotulo, icone: Icone }) => {
                const on = ativo(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={aoNavegar}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      on
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/85 hover:bg-white/10 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icone className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                    {rotulo}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 rounded-xl bg-white/14 p-2.5">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
        >
          {iniciais(usuario.nome)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{ROTULO_PAPEL[usuario.papel] ?? usuario.papel}</p>
        </div>
        <form action={sair}>
          <button
            type="submit"
            title="Sair"
            className="grid size-8 place-items-center rounded-lg text-sidebar-foreground/80 transition-colors outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only">Sair</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/** Menu fixo à esquerda (telas a partir de 1024px). */
export function MenuLateral({ usuario }: { usuario: UsuarioMenu }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-degrade-menu lg:block">
      <ConteudoMenu usuario={usuario} />
    </aside>
  );
}

/** Barra superior com botão hambúrguer e menu em gaveta (telas menores que 1024px). */
export function MenuMovel({ usuario }: { usuario: UsuarioMenu }) {
  const [aberto, setAberto] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-degrade-destaque px-4 shadow-flutuante lg:hidden">
      <Link href="/inicio">
        <Logo />
      </Link>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetTrigger
          className="grid size-10 place-items-center rounded-lg text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="gap-0 border-0 bg-degrade-menu p-0 data-[side=left]:w-72 data-[side=left]:max-w-[85vw]"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetClose
            className="absolute top-5 right-3 grid size-9 place-items-center rounded-lg text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Fechar menu"
          >
            <X className="size-5" aria-hidden />
          </SheetClose>
          <ConteudoMenu usuario={usuario} aoNavegar={() => setAberto(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
