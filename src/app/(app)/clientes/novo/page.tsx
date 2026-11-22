import Link from "next/link";

import { listarOpcoesIndicacao } from "@/db/clientes";
import { exigirPermissaoPagina } from "@/lib/auth";
import { FormularioCliente } from "../formulario-cliente";

export default async function NovoClientePage() {
  await exigirPermissaoPagina("clientes.editar");
  const opcoes = await listarOpcoesIndicacao();
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Novo cliente</h1>
        <Link href="/clientes" className="text-sm underline">Voltar</Link>
      </div>
      <FormularioCliente valores={{}} suspeitos={[]} opcoesIndicacao={opcoes} somenteLeitura={false} />
    </div>
  );
}
