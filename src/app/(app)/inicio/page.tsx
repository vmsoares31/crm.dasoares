import Link from "next/link";
import { ArrowRight, Building2, ClipboardList, FileWarning, HeartHandshake, Table2, TriangleAlert, UserCheck, Users } from "lucide-react";

import { CabecalhoPagina } from "@/components/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { resumoPendencias } from "@/db/clientes";
import { contagensInicio } from "@/db/painel";
import { pode } from "@/domain/permissoes";
import { usuarioAtual } from "@/lib/auth";

const ATALHOS = [
  { href: "/clientes", titulo: "Clientes", texto: "Lista, filtros e ficha de cada cliente", icone: Users },
  { href: "/clientes/edicao-em-massa", titulo: "Edição em massa", texto: "Honorários, vencimentos e carteiras", icone: Table2, massa: true },
  { href: "/escritorio", titulo: "Escritório", texto: "Dados da contratada e parâmetros", icone: Building2 },
];

export default async function InicioPage() {
  const [usuario, resumo, contagens] = await Promise.all([usuarioAtual(), resumoPendencias(), contagensInicio()]);
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0] ?? "";
  const podeMassa = !!usuario && pode(usuario.permissoes, "clientes.editar") && pode(usuario.permissoes, "contratos.editar");
  const cartoes = [
    { href: "/clientes?situacao=ativo", rotulo: "Clientes ativos", valor: contagens.ativos, nota: "Ver clientes ativos", icone: UserCheck },
    { href: "/clientes?situacao=a_revisar", rotulo: "Clientes a revisar", valor: resumo.aRevisar, nota: "Vindos da importação, aguardando conferência", icone: ClipboardList, alerta: true },
    { href: "/clientes?pendencias=1", rotulo: "Cadastros incompletos", valor: resumo.incompletos, nota: "Clientes ativos ou a revisar com pendências", icone: TriangleAlert, alerta: true },
    { href: "/contratos?situacao=fechado&legado=nao&documento=sem", rotulo: "Contratos sem documento", valor: contagens.contratosSemDocumento, nota: "Fechados (não anteriores) sem documento gerado", icone: FileWarning, alerta: true },
    { href: "/indicacoes?situacao=aguardando", rotulo: "Indicações aguardando", valor: contagens.indicacoesAguardando, nota: "Aguardando o 1º pagamento do indicado", icone: HeartHandshake },
  ];
  const atalhos = ATALHOS.filter((a) => !a.massa || podeMassa);
  const hoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <div className="space-y-8">
      <CabecalhoPagina titulo={primeiroNome ? `Olá, ${primeiroNome}` : "Início"} descricao={<span className="first-letter:uppercase">{hoje}</span>} />

      <section aria-label="Resumo dos cadastros" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map(({ href, rotulo, valor, nota, icone: Icone, alerta }) => (
          <Link key={rotulo} href={href} className="group outline-none">
            <Card className="h-full px-5 transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
              <span className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {rotulo}
                <Icone className={`size-5 ${alerta && valor > 0 ? "text-warning" : "text-muted-foreground"}`} aria-hidden />
              </span>
              <strong className="block font-heading text-3xl font-extrabold text-heading tabular-nums">{valor}</strong>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                {nota}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-[0.08em] text-muted-foreground uppercase">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map(({ href, titulo, texto, icone: Icone }) => (
            <Link key={href} href={href} className="group outline-none">
              <Card size="sm" className="h-full flex-row items-center gap-4 px-4 transition-colors group-hover:bg-muted group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icone className="size-5" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-heading">{titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{texto}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
