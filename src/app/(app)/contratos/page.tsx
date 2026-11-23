import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Selo } from "@/components/situacao-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listarCarteiras } from "@/db/carteiras";
import { CONTRATOS_POR_PAGINA, listarContratos } from "@/db/contratos";
import { formatarBRL } from "@/domain/dinheiro";
import { ROTULOS_SITUACAO_CONTRATO, ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";

type Busca = { q?: string; situacao?: string; carteira?: string; legado?: string; documento?: string; pagina?: string };

export default async function ContratosPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const [{ linhas, total }, carteiras] = await Promise.all([
    listarContratos({ busca: sp.q, situacao: sp.situacao, carteira: sp.carteira, legado: sp.legado, documento: sp.documento, pagina }),
    listarCarteiras(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / CONTRATOS_POR_PAGINA));
  const href = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") u.set(k, v);
    u.set("pagina", String(p));
    return `/contratos?${u.toString()}`;
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Contratos" descricao={`${total} contrato(s) encontrado(s)`} />

      <Card size="sm" className="px-4">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Nome do cliente" aria-label="Buscar por nome do cliente" className="campo w-full pl-9" />
          </div>
          <select name="situacao" defaultValue={sp.situacao ?? ""} className="campo">
            <option value="">Todas as situações</option>
            {Object.entries(ROTULOS_SITUACAO_CONTRATO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select name="carteira" defaultValue={sp.carteira ?? ""} className="campo">
            <option value="">Todas as carteiras</option>
            {carteiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select name="legado" defaultValue={sp.legado ?? ""} className="campo">
            <option value="">Anteriores e novos</option>
            <option value="sim">Somente anteriores (legado)</option>
            <option value="nao">Somente novos</option>
          </select>
          <select name="documento" defaultValue={sp.documento ?? ""} className="campo" aria-label="Documento">
            <option value="">Com ou sem documento</option>
            <option value="sem">Sem documento gerado</option>
          </select>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Link href="/contratos" className={buttonVariants({ variant: "ghost" })}>Limpar</Link>
            <button type="submit" className={buttonVariants()}>Filtrar</button>
          </div>
        </form>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr><th>Cliente</th><th>Situação</th><th>Honorário</th><th>Vencimento</th><th>Carteira</th><th>Tipo</th></tr>
            </thead>
            <tbody>
              {linhas.map((k) => (
                <tr key={k.id}>
                  <td className="max-w-80"><Link href={`/contratos/${k.id}`} className="link block truncate">{k.cliente.razao_social}</Link></td>
                  <td className="whitespace-nowrap">
                    <Selo tom={k.situacao === "fechado" ? "sucesso" : k.situacao === "encerrado" ? "neutro" : "alerta"}>
                      {ROTULOS_SITUACAO_CONTRATO[k.situacao as keyof typeof ROTULOS_SITUACAO_CONTRATO]}
                    </Selo>
                    {k.legado && <span className="ml-2 text-xs text-muted-foreground">anterior</span>}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{k.honorario != null ? formatarBRL(k.honorario) : "—"}</td>
                  <td className="whitespace-nowrap">{k.dia_vencimento != null ? `dia ${k.dia_vencimento}` : "—"}</td>
                  <td className="whitespace-nowrap">{k.carteiraNome ?? "—"}</td>
                  <td className="whitespace-nowrap">{k.tipo_cobranca ? (ROTULOS_TIPO_COBRANCA[k.tipo_cobranca as keyof typeof ROTULOS_TIPO_COBRANCA] ?? k.tipo_cobranca) : "—"}</td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum contrato encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
          {pagina > 1 ? (
            <Link href={href(pagina - 1)} className={buttonVariants({ variant: "outline" })}><ChevronLeft aria-hidden /> Anterior</Link>
          ) : <span />}
          <span className="text-muted-foreground">Página {pagina} de {paginas}</span>
          {pagina < paginas ? (
            <Link href={href(pagina + 1)} className={buttonVariants({ variant: "outline" })}>Próxima <ChevronRight aria-hidden /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
