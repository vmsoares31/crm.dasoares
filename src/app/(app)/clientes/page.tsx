import Link from "next/link";

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
  const sel = "rounded border px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        {podeEditar && (
          <>
            <Link href="/clientes/novo" className="text-sm underline">Novo cliente</Link>
            <Link href="/clientes/edicao-em-massa" className="text-sm underline">Edição em massa</Link>
          </>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Nome ou CNPJ/CPF" className={`${sel} w-64`} />
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
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="pendencias" value="1" defaultChecked={sp.pendencias === "1"} /> Com pendências
        </label>
        <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-muted">Filtrar</button>
        <Link href="/clientes" className="pb-2 text-sm underline">Limpar</Link>
      </form>

      <p className="text-sm text-muted-foreground">{total} cliente(s)</p>
      <table className="w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">Razão social</th><th className="pr-3">CPF/CNPJ</th><th className="pr-3">Regime</th>
            <th className="pr-3">Carteira</th><th className="pr-3">Situação</th><th>Pendências</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="py-2 pr-3"><Link href={`/clientes/${c.id}`} className="underline">{c.razao_social}</Link></td>
              <td className="pr-3">{c.documento ? formatarDocumento(c.documento) : "—"}</td>
              <td className="pr-3">{c.regime ? ROTULOS_REGIME[c.regime as keyof typeof ROTULOS_REGIME] : "—"}</td>
              <td className="pr-3">{c.carteiraNome ?? "—"}</td>
              <td className="pr-3">{ROTULOS_SITUACAO_CLIENTE[c.situacao as keyof typeof ROTULOS_SITUACAO_CLIENTE]}</td>
              <td>
                {c.pendencias.length > 0 ? (
                  <span title={c.pendencias.map((p) => ROTULOS_PENDENCIA[p]).join(", ")} className="rounded bg-muted px-2 py-0.5 text-xs">
                    {c.pendencias.length} pendência(s)
                  </span>
                ) : "—"}
              </td>
            </tr>
          ))}
          {linhas.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
        </tbody>
      </table>

      {paginas > 1 && (
        <nav className="flex items-center gap-4 text-sm">
          {pagina > 1 && <Link href={href(pagina - 1)} className="underline">Anterior</Link>}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link href={href(pagina + 1)} className="underline">Próxima</Link>}
        </nav>
      )}
    </div>
  );
}
