import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card } from "@/components/ui/card";
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
      <CabecalhoPagina titulo="Usuários" descricao="Convide pessoas da equipe e defina o papel de cada uma." />
      <FormularioConvite />
      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Papel</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(perfis ?? []).map((p) => (
                <LinhaUsuario key={p.usuario_id} id={p.usuario_id} nome={p.nome} papel={p.papel as Papel} ativo={p.ativo} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
