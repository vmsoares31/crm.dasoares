import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CabecalhoPagina
        titulo="Serviços extras"
        voltar={{ href: "/escritorio", rotulo: "Escritório" }}
        descricao={somenteLeitura ? "Somente leitura: apenas administradores podem alterar." : "Serviços cobrados à parte do honorário mensal."}
      />
      <Card className="gap-0 divide-y py-0">
        {servicos.map((s) => (
          <FormularioServico key={s.id + s.atualizado_em} id={s.id} nome={s.nome} valor={formatarBRL(s.valor)} ativo={s.ativo} somenteLeitura={somenteLeitura} />
        ))}
        {servicos.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum serviço extra cadastrado.</p>}
      </Card>
      {!somenteLeitura && (
        <Card className="gap-0 pb-1">
          <CardHeader>
            <CardTitle><h2>%s</h2></CardTitle>
          </CardHeader>
          <FormularioServico somenteLeitura={false} />
        </Card>
      )}
    </div>
  );
}
