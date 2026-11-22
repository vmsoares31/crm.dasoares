import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { listarOpcoesIndicacao } from "@/db/clientes";
import { exigirPermissaoPagina } from "@/lib/auth";
import { FormularioCliente } from "../formulario-cliente";

export default async function NovoClientePage() {
  await exigirPermissaoPagina("clientes.editar");
  const opcoes = await listarOpcoesIndicacao();
  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina titulo="Novo cliente" voltar={{ href: "/clientes", rotulo: "Clientes" }} />
      <Card className="px-5">
        <FormularioCliente valores={{}} suspeitos={[]} opcoesIndicacao={opcoes} somenteLeitura={false} />
      </Card>
    </div>
  );
}
