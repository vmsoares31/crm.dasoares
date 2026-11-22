import Link from "next/link";

import { listarServicosExtras } from "@/db/servicos-extras";
import { formatarBRL } from "@/domain/dinheiro";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { FormularioServico } from "./formulario-servico";

export default async function ServicosExtrasPage() {
  const usuario = await usuarioAtual();
  const somenteLeitura = !usuario || !pode(usuario.permissoes, "escritorio.editar");
  const servicos = await listarServicosExtras();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Serviços extras</h1>
        <Link href="/escritorio" className="text-sm underline">Voltar ao escritório</Link>
      </div>
      {somenteLeitura && <p className="text-sm text-muted-foreground">Somente leitura: apenas administradores podem alterar.</p>}
      <div>
        {servicos.map((s) => (
          <FormularioServico key={s.id + s.atualizado_em} id={s.id} nome={s.nome} valor={formatarBRL(s.valor)} ativo={s.ativo} somenteLeitura={somenteLeitura} />
        ))}
        {servicos.length === 0 && <p className="text-sm">Nenhum serviço extra cadastrado.</p>}
      </div>
      {!somenteLeitura && (
        <section className="space-y-2">
          <h2 className="font-medium">Novo serviço</h2>
          <FormularioServico somenteLeitura={false} />
        </section>
      )}
    </div>
  );
}
