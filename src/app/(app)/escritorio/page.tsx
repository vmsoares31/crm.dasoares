import Link from "next/link";
import { Layers, TrendingUp, Wallet } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { buttonVariants } from "@/components/ui/button";

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
  const podeReajustar = !!usuario && pode(usuario.permissoes, "reajuste.aplicar");
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
      <CabecalhoPagina
        titulo="Escritório"
        descricao={somenteLeitura ? "Somente leitura: apenas administradores podem alterar." : "Dados da contratada usados nos contratos e parâmetros das cobranças."}
        acoes={
          <nav aria-label="Cadastros do escritório" className="flex flex-wrap gap-2">
            <Link href="/escritorio/carteiras" className={buttonVariants({ variant: "outline" })}>
              <Wallet aria-hidden /> Carteiras
            </Link>
            <Link href="/escritorio/servicos-extras" className={buttonVariants({ variant: "outline" })}>
              <Layers aria-hidden /> Serviços extras
            </Link>
            {podeReajustar && (
              <Link href="/escritorio/reajuste" className={buttonVariants({ variant: "outline" })}>
                <TrendingUp aria-hidden /> Reajuste anual
              </Link>
            )}
          </nav>
        }
      />
      <FormularioEscritorio valores={valores} somenteLeitura={somenteLeitura} />
      <ModeloContrato caminho={e.modelo_contrato_path} somenteLeitura={somenteLeitura} />
    </div>
  );
}
