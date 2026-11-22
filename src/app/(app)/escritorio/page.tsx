import Link from "next/link";

import { obterEscritorio } from "@/db/escritorio";
import { formatarDocumento } from "@/domain/documentos";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";
import { FormularioEscritorio } from "./formulario-escritorio";
import { ModeloContrato } from "./modelo-contrato";

const pct = (n: number) => String(n).replace(".", ",");

export default async function EscritorioPage() {
  const usuario = await usuarioAtual();
  const somenteLeitura = !usuario || !pode(usuario.permissoes, "escritorio.editar");
  const e = await obterEscritorio();

  const valores: Record<string, string> = {
    razao_social: e.razao_social,
    cnpj: formatarDocumento(e.cnpj),
    logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro,
    cidade: e.cidade, uf: e.uf, cep: e.cep, telefone: e.telefone, email: e.email,
    inscricao_municipal: e.inscricao_municipal, responsavel_tecnico: e.responsavel_tecnico,
    crc: e.crc, cidade_foro: e.cidade_foro,
    multa_pct: pct(e.multa_pct),
    juros_mes_pct: pct(e.juros_mes_pct),
    nome_cobranca: e.nome_cobranca,
    dia_vencimento_padrao: String(e.dia_vencimento_padrao),
    indicacao_pct: pct(e.indicacao_pct),
    notificar_em: e.notificar_em,
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Escritório</h1>
      {somenteLeitura && <p className="text-sm text-muted-foreground">Somente leitura: apenas administradores podem alterar.</p>}
      <nav className="flex gap-4 text-sm underline">
        <Link href="/escritorio/carteiras">Carteiras</Link>
        <Link href="/escritorio/servicos-extras">Serviços extras</Link>
      </nav>
      <FormularioEscritorio valores={valores} somenteLeitura={somenteLeitura} />
      <ModeloContrato caminho={e.modelo_contrato_path} somenteLeitura={somenteLeitura} />
    </div>
  );
}
