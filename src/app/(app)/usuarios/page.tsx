import type { Papel } from "@/domain/permissoes";
import { exigirPermissaoPagina } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { FormularioConvite } from "./formulario-convite";
import { LinhaUsuario } from "./linha-usuario";

export default async function UsuariosPage() {
  await exigirPermissaoPagina("usuarios.gerenciar");
  const supabase = await createServerClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("usuario_id, nome, papel, ativo")
    .order("nome");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <FormularioConvite />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">Nome</th>
            <th className="p-2">Papel</th>
            <th className="p-2">Situação</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {(perfis ?? []).map((p) => (
            <LinhaUsuario key={p.usuario_id} id={p.usuario_id} nome={p.nome} papel={p.papel as Papel} ativo={p.ativo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
