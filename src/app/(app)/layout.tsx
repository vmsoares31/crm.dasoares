import { redirect } from "next/navigation";

import { MenuLateral, MenuMovel, type UsuarioMenu } from "@/components/layout/menu-lateral";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  const menu: UsuarioMenu = {
    nome: usuario.nome,
    papel: usuario.papel,
    mostrarUsuarios: pode(usuario.permissoes, "usuarios.gerenciar"),
  };

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <MenuLateral usuario={menu} />
      <MenuMovel usuario={menu} />
      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
