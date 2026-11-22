import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CabecalhoPagina
        titulo="Carteiras"
        voltar={{ href: "/escritorio", rotulo: "Escritório" }}
        descricao={somenteLeitura ? "Somente leitura: apenas administradores podem alterar." : "Contas de cobrança e a forma de saída de cada uma."}
      />
      <Card className="gap-0 divide-y py-0">
        {carteiras.map((c) => (
          <FormularioCarteira key={c.id + c.atualizado_em} id={c.id} nome={c.nome} saida={c.saida} ativa={c.ativa} somenteLeitura={somenteLeitura} />
        ))}
        {carteiras.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma carteira cadastrada.</p>}
      </Card>
      {!somenteLeitura && (
        <Card className="gap-0 pb-1">
          <CardHeader>
            <CardTitle><h2>%s</h2></CardTitle>
          </CardHeader>
          <FormularioCarteira somenteLeitura={false} />
        </Card>
      )}
    </div>
  );
}
