import Link from "next/link";

import { listarCarteiras } from "@/db/carteiras";
import { listarClientesParaMassa } from "@/db/clientes";
import { formatarBRL } from "@/domain/dinheiro";
import { exigirPermissaoPagina } from "@/lib/auth";
import { TabelaMassa, type LinhaMassaVista } from "./tabela-massa";

export default async function EdicaoEmMassaPage() {
  await exigirPermissaoPagina("clientes.editar");
  await exigirPermissaoPagina("contratos.editar");
  const [clientes, carteiras] = await Promise.all([listarClientesParaMassa(), listarCarteiras()]);

  const linhas: LinhaMassaVista[] = clientes.map((c) => ({
    clienteId: c.id,
    nome: c.razao_social,
    pendencias: c.pendencias.length,
    valores: {
      regime: c.regime ?? "",
      honorario: c.contrato?.honorario != null ? formatarBRL(c.contrato.honorario) : "",
      dia_vencimento: c.contrato?.dia_vencimento != null ? String(c.contrato.dia_vencimento) : "",
      carteira_id: c.contrato?.carteira_id ?? "",
      tipo_cobranca: c.contrato?.tipo_cobranca ?? "",
      email_cobranca: c.contrato?.email_cobranca ?? "",
    },
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Edição em massa</h1>
        <Link href="/clientes" className="text-sm underline">Voltar aos clientes</Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Clientes ativos e a revisar. Somente as linhas alteradas são salvas; clientes sem contrato recebem um contrato legado (fechado).
      </p>
      <TabelaMassa linhas={linhas} carteiras={carteiras.filter((c) => c.ativa).map((c) => ({ id: c.id, nome: c.nome }))} />
    </div>
  );
}
