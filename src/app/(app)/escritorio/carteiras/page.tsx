import Link from "next/link";

import { listarCarteiras } from "@/db/carteiras";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { FormularioCarteira } from "./formulario-carteira";

export default async function CarteirasPage() {
  const usuario = await usuarioAtual();
  const somenteLeitura = !usuario || !pode(usuario.permissoes, "escritorio.editar");
  const carteiras = await listarCarteiras();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Carteiras</h1>
        <Link href="/escritorio" className="text-sm underline">Voltar ao escritório</Link>
      </div>
      {somenteLeitura && <p className="text-sm text-muted-foreground">Somente leitura: apenas administradores podem alterar.</p>}
      <div>
        {carteiras.map((c) => (
          <FormularioCarteira key={c.id + c.atualizado_em} id={c.id} nome={c.nome} saida={c.saida} ativa={c.ativa} somenteLeitura={somenteLeitura} />
        ))}
        {carteiras.length === 0 && <p className="text-sm">Nenhuma carteira cadastrada.</p>}
      </div>
      {!somenteLeitura && (
        <section className="space-y-2">
          <h2 className="font-medium">Nova carteira</h2>
          <FormularioCarteira somenteLeitura={false} />
        </section>
      )}
    </div>
  );
}
