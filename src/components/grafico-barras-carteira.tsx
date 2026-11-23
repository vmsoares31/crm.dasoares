import { formatarBRL } from "@/domain/dinheiro";

export type BarraCarteira = { rotulo: string; previsto: number; recebido: number };

/**
 * Barras horizontais (previsto x recebido) por carteira, em CSS puro com as cores do tema.
 * Cada linha traz os valores por extenso e um rótulo acessível; a escala é a maior barra.
 */
export function GraficoBarrasCarteira({ dados }: { dados: BarraCarteira[] }) {
  const maximo = Math.max(1, ...dados.map((d) => Math.max(d.previsto, d.recebido)));
  const largura = (v: number) => `${Math.max(0, Math.min(100, (v / maximo) * 100))}%`;
  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 pb-3 text-xs text-muted-foreground" aria-hidden>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-4" />Previsto</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1" />Recebido</li>
      </ul>
      <ul className="space-y-4">
        {dados.map((d) => (
          <li key={d.rotulo}>
            <div className="mb-1 text-sm font-medium text-heading">{d.rotulo}</div>
            <div
              className="space-y-1"
              role="img"
              aria-label={`${d.rotulo}: previsto ${formatarBRL(d.previsto)}, recebido ${formatarBRL(d.recebido)}`}
            >
              {([["previsto", d.previsto, "bg-chart-4"], ["recebido", d.recebido, "bg-chart-1"]] as const).map(([nome, valor, cor]) => (
                <div key={nome} className="flex items-center gap-3">
                  <div className="h-4 min-w-0 flex-1 rounded-sm bg-muted">
                    <div className={`h-full rounded-sm ${cor}`} style={{ width: largura(valor) }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs tabular-nums text-foreground">{formatarBRL(valor)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
