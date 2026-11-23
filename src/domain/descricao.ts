import { formatarBRL } from "./dinheiro";
import type { ItemCobranca } from "./tipos";

/** Descrição da cobrança: "Mensalidade R$ 220,00 + Extra R$ 50,00 − Desconto indicação R$ 150,00". */
export function montarDescricao(itens: ItemCobranca[]): string {
  return itens
    .map((it, i) => {
      const negativo = it.valor < 0 || it.tipo === "desconto_indicacao";
      const texto = `${it.descricao} ${formatarBRL(Math.abs(it.valor))}`;
      if (i === 0) return negativo ? `− ${texto}` : texto;
      return `${negativo ? "−" : "+"} ${texto}`;
    })
    .join(" ");
}
