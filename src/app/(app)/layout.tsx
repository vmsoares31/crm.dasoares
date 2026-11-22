import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { sair } from "../(auth)/login/actions";

const MENU = [
  { href: "/inicio", rotulo: "Início" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/contratos", rotulo: "Contratos" },
  { href: "/extras", rotulo: "Extras" },
  { href: "/indicacoes", rotulo: "Indicações" },
  { href: "/financeiro", rotulo: "Financeiro" },
  { href: "/escritorio", rotulo: "Escritório" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  const itens = pode(usuario.permissoes, "usuarios.gerenciar")
    ? [...MENU, { href: "/usuarios", rotulo: "Usuários" }]
    : MENU;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col gap-4 border-r p-4">
        <p className="font-semibold">CRM D.A. Soares</p>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {itens.map((i) => (
            <Link key={i.href} href={i.href} className="rounded px-2 py-1.5 hover:bg-muted">
              {i.rotulo}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>{usuario.nome}</p>
          <form action={sair}>
            <Button type="submit" variant="outline" size="sm" className="w-full">Sair</Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
