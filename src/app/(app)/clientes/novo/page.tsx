import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { exigirPermissaoPagina } from "@/lib/auth";
import { FormularioCliente } from "../formulario-cliente";

export default async function NovoClientePage() {
  await exigirPermissaoPagina("clientes.editar");
  return (
    <div className="max-w-4xl space-y-6">
      <CabecalhoPagina titulo="Novo cliente" voltar={{ href: "/clientes", rotulo: "Clientes" }} />
      <Card className="px-5">
        <FormularioCliente valores={{}} suspeitos={[]} somenteLeitura={false} />
      </Card>
    </div>
  );
}
