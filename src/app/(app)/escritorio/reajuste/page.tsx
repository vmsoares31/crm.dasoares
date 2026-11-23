import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { listarContratosReajustaveis } from "@/db/reajuste";
import { listarServicosExtras } from "@/db/servicos-extras";
import { exigirPermissaoPagina } from "@/lib/auth";
import { PainelReajuste } from "./painel-reajuste";

export default async function ReajustePage() {
  await exigirPermissaoPagina("escritorio.editar");
  const [contratos, servicos] = await Promise.all([listarContratosReajustaveis(), listarServicosExtras()]);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Reajuste anual"
        voltar={{ href: "/escritorio", rotulo: "Escritório" }}
        descricao="Informe o percentual, confira a prévia, ajuste valores se necessário e aplique."
      />
      <PainelReajuste
        contratos={contratos}
        servicos={servicos.map((s) => ({ id: s.id, nome: s.nome, valor: s.valor, ativo: s.ativo }))}
      />
    </div>
  );
}
