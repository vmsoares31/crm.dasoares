import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, Table2 } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Selo, SituacaoBadge } from "@/components/situacao-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { listarClientes, POR_PAGINA } from "@/db/clientes";
import { listarCarteiras } from "@/db/carteiras";
import { ROTULOS_PENDENCIA } from "@/domain/completude";
import { formatarDocumento } from "@/domain/documentos";
import { pode } from "@/domain/permissoes";
import { ROTULOS_REGIME, ROTULOS_SITUACAO_CLIENTE } from "@/domain/rotulos";
import { usuarioAtual } from "@/lib/auth";

type Busca = { q?: string; regime?: string; carteira?: string; situacao?: string; pendencias?: string; pagina?: string };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const usuario = await usuarioAtual();
  const podeEditar = !!usuario && pode(usuario.permissoes, "clientes.editar");
  const [{ linhas, total }, carteiras] = await Promise.all([
    listarClientes({
      busca: sp.q, regime: sp.regime, carteira: sp.carteira, situacao: sp.situacao,
      pendencias: sp.pendencias === "1", pagina,
    }),
    listarCarteiras(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const href = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") u.set(k, v);
    u.set("pagina", String(p));
    return `/clientes?${u.toString()}`;
  };
  const sel = "campo";

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Clientes"
        descricao={`${total} cliente(s) encontrado(s)`}
        acoes={
          podeEditar && (
            <>
              <Link href="/clientes/edicao-em-massa" className={buttonVariants({ variant: "outline" })}>
                <Table2 aria-hidden /> Edição em massa
              </Link>
              <Link href="/clientes/novo" className={buttonVariants()}>
                <Plus aria-hidden /> Novo cliente
              </Link>
            </>
          )
        }
      />

      <Card size="sm" className="px-4">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Nome ou CNPJ/CPF" aria-label="Buscar por nome ou CNPJ/CPF" className={`${sel} w-full pl-9`} />
          </div>
          <select name="regime" defaultValue={sp.regime ?? ""} className={sel}>
            <option value="">Todos os regimes</option>
            {Object.entries(ROTULOS_REGIME).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select name="carteira" defaultValue={sp.carteira ?? ""} className={sel}>
            <option value="">Todas as carteiras</option>
            {carteiras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select name="situacao" defaultValue={sp.situacao ?? ""} className={sel}>
            <option value="">Todas as situações</option>
            {Object.entries(ROTULOS_SITUACAO_CLIENTE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="pendencias" value="1" defaultChecked={sp.pendencias === "1"} /> Com pendências
          </label>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Link href="/clientes" className={buttonVariants({ variant: "ghost" })}>Limpar</Link>
            <button type="submit" className={buttonVariants()}>Filtrar</button>
          </div>
        </form>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Razão social</th><th>CPF/CNPJ</th><th>Regime</th>
                <th>Carteira</th><th>Situação</th><th>Pendências</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-80"><Link href={`/clientes/${c.id}`} className="link block truncate">{c.razao_social}</Link></td>
                  <td className="whitespace-nowrap">{c.documento ? formatarDocumento(c.documento) : "—"}</td>
                  <td className="whitespace-nowrap">{c.regime ? ROTULOS_REGIME[c.regime as keyof typeof ROTULOS_REGIME] : "—"}</td>
                  <td className="whitespace-nowrap">{c.carteiraNome ?? "—"}</td>
                  <td>
                    <SituacaoBadge situacao={c.situacao} rotulo={ROTULOS_SITUACAO_CLIENTE[c.situacao as keyof typeof ROTULOS_SITUACAO_CLIENTE]} />
                  </td>
                  <td>
                    {c.pendencias.length > 0 ? (
                      <span title={c.pendencias.map((p) => ROTULOS_PENDENCIA[p]).join(", ")}>
                        <Selo tom="alerta">{c.pendencias.length} pendência(s)</Selo>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
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
