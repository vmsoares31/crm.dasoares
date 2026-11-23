import { montarDescricao } from "./descricao";
import {
  montarCobrancasDoMes,
  type ContratoFechamento,
  type ExtraPendente,
  type ResultadoFechamento,
} from "./fechamento";
import type { Centavos, Competencia, ItemCobranca, SituacaoCobranca, TipoItem } from "./tipos";

/** Cobrança já gravada na competência (o que importa para abrir/regerar). */
export interface CobrancaExistente {
  id: string; clienteId: string; contratoId: string;
  origem: "mensal" | "parcela_avulsa"; parcelaId: string | null; situacao: SituacaoCobranca;
  /** Cancelada por "Excluir do mês" (não deve ser refeita na competência). */
  excluidaDoMes?: boolean;
}
export interface ExtraDaCompetencia {
  id: string; clienteId: string; descricao: string; valor: Centavos; competencia: string;
  situacao: "pendente" | "incluido" | "cancelado"; cobrancaId: string | null;
}
export interface MovimentoCredito {
  clienteId: string; tipo: "gerado" | "liberado" | "usado" | "estornado"; valor: Centavos; cobrancaId: string | null;
}
export interface DadosCompetencia {
  competencia: Competencia; regerar: boolean;
  contratos: ContratoFechamento[];          // contratos `fechado` de clientes `ativo`
  cobrancasExistentes: CobrancaExistente[]; // cobranças já gravadas na competência
  extras: ExtraDaCompetencia[];             // lançamentos extras (qualquer situação)
  movimentos: MovimentoCredito[];           // movimentos de crédito dos clientes
}
export interface PlanoCompetencia extends ResultadoFechamento {
  /** Ids das cobranças que a regeração apaga (prevista/quitada_por_credito). */
  removidas: string[];
  /** Cobranças existentes que ficam como estão (emitida, paga, paga_parcial, cancelada ou, ao abrir, prevista). */
  mantidas: CobrancaExistente[];
}

/** Situações que a regeração pode apagar e refazer. */
export const SITUACOES_REGERAVEIS: readonly SituacaoCobranca[] = ["prevista", "quitada_por_credito"];

/**
 * Uma cobrança existente impede gerar outra com a mesma chave quando não está cancelada,
 * ou quando foi cancelada por "Excluir do mês". Cancelada pelo "Cancelar" geral, a chave fica
 * livre e o próximo "Abrir mês"/"Regerar previstas" gera a substituta (reemissão).
 */
export function bloqueiaChave(c: Pick<CobrancaExistente, "situacao" | "excluidaDoMes">): boolean {
  return c.situacao !== "cancelada" || c.excluidaDoMes === true;
}

export function chaveCobranca(c: { contratoId: string; origem: string; parcelaId: string | null }): string {
  return `${c.contratoId}|${c.origem}|${c.parcelaId ?? ""}`;
}

/** Saldo de crédito disponível por cliente: liberado − usado + estornado. */
export function saldoDeCredito(movimentos: MovimentoCredito[]): Record<string, Centavos> {
  const saldo: Record<string, Centavos> = {};
  for (const m of movimentos) {
    const sinal = m.tipo === "liberado" || m.tipo === "estornado" ? 1 : m.tipo === "usado" ? -1 : 0;
    if (sinal === 0) continue;
    saldo[m.clienteId] = (saldo[m.clienteId] ?? 0) + sinal * m.valor;
  }
  return saldo;
}

/**
 * Decide o que gravar ao abrir (regerar=false) ou regerar (regerar=true) a competência.
 *
 * - Abrir: não mexe no que já existe; só monta cobranças para contrato/origem/parcela sem cobrança.
 * - Regerar: considera apagadas as cobranças `prevista`/`quitada_por_credito` (seus extras voltam a
 *   pendente e o crédito usado volta ao saldo) e monta de novo, exceto onde já existe cobrança
 *   emitida, paga, paga parcialmente ou excluída do mês naquela competência/origem.
 * - Cobrança cancelada pelo "Cancelar" geral não bloqueia: abrir/regerar gera a substituta.
 * - Só entram extras `pendente` da competência (mais os que voltam a pendente pela regeração).
 *   Extras de clientes não gerados, ou cuja cobrança foi mantida, continuam pendentes.
 */
export function planejarCompetencia(d: DadosCompetencia): PlanoCompetencia {
  const removiveis = d.regerar ? d.cobrancasExistentes.filter((c) => SITUACOES_REGERAVEIS.includes(c.situacao)) : [];
  const idsRemovidos = new Set(removiveis.map((c) => c.id));
  const mantidas = d.cobrancasExistentes.filter((c) => !idsRemovidos.has(c.id));
  const bloqueadas = new Set(mantidas.filter(bloqueiaChave).map(chaveCobranca));

  const extras: ExtraPendente[] = d.extras
    .filter((e) => e.competencia === d.competencia)
    .filter((e) => e.situacao === "pendente" || (e.situacao === "incluido" && e.cobrancaId !== null && idsRemovidos.has(e.cobrancaId)))
    .map((e) => ({ id: e.id, clienteId: e.clienteId, descricao: e.descricao, valor: e.valor }));

  const saldo = saldoDeCredito(
    d.movimentos.filter((m) => !(m.tipo === "usado" && m.cobrancaId !== null && idsRemovidos.has(m.cobrancaId))),
  );

  const montado = montarCobrancasDoMes({ competencia: d.competencia, contratos: d.contratos, extras, saldoCredito: saldo });
  return {
    cobrancas: montado.cobrancas.filter((c) => !bloqueadas.has(chaveCobranca(c))),
    naoGerados: montado.naoGerados,
    removidas: removiveis.map((c) => c.id),
    mantidas,
  };
}

// ---------------------------------------------------------------------------
// Edição dos itens de uma cobrança prevista
// ---------------------------------------------------------------------------

const TIPOS: readonly TipoItem[] = ["mensalidade", "extra", "parcela_adicional", "desconto_indicacao"];
const MINIMO_COM_DESCONTO: Centavos = 2000;

export type EdicaoValidada =
  | { erro: string }
  | { itens: ItemCobranca[]; total: Centavos; descricao: string; extrasLiberados: string[] };

/**
 * Valida a nova lista de itens de uma cobrança prevista.
 * O desconto de indicação não é editável aqui (o crédito usado já está registrado);
 * itens com vínculo (extra/parcela) só podem ser mantidos ou removidos, nunca criados.
 */
export function validarEdicaoItens(antigos: ItemCobranca[], novos: ItemCobranca[]): EdicaoValidada {
  if (novos.length === 0) return { erro: "A cobrança precisa ter ao menos um item." };

  const refsAntigas = new Map(antigos.filter((i) => i.refId).map((i) => [i.refId!, i.tipo]));
  const vistas = new Set<string>();
  const itens: ItemCobranca[] = [];
  for (const i of novos) {
    const descricao = i.descricao.trim();
    if (!TIPOS.includes(i.tipo)) return { erro: "Tipo de item inválido." };
    if (!descricao) return { erro: "Informe a descrição de todos os itens." };
    if (!Number.isInteger(i.valor)) return { erro: "Valor inválido." };
    if (i.tipo !== "desconto_indicacao" && i.valor < 0) return { erro: "Somente o desconto de indicação pode ser negativo." };
    if (i.refId) {
      if (refsAntigas.get(i.refId) !== i.tipo || vistas.has(i.refId)) return { erro: "Item vinculado inválido." };
      vistas.add(i.refId);
    }
    itens.push({ tipo: i.tipo, descricao, valor: i.valor, ...(i.refId ? { refId: i.refId } : {}) });
  }

  const descontos = (l: ItemCobranca[]) => l.filter((i) => i.tipo === "desconto_indicacao").map((i) => i.valor).sort((a, b) => a - b);
  if (descontos(antigos).join(",") !== descontos(itens).join(",")) {
    return { erro: "O desconto de indicação não pode ser alterado na edição." };
  }

  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (total <= 0) return { erro: "O total da cobrança precisa ser maior que zero." };
  if (descontos(itens).length > 0 && total < MINIMO_COM_DESCONTO) {
    return { erro: "Com desconto de indicação, a cobrança não pode ficar abaixo de R$ 20,00." };
  }

  const extrasLiberados = antigos
    .filter((i) => i.tipo === "extra" && i.refId && !vistas.has(i.refId))
    .map((i) => i.refId!);
  return { itens, total, descricao: montarDescricao(itens), extrasLiberados };
}

/** Só cobranças previstas podem ser editadas ou excluídas do mês. */
export function podeAlterarCobranca(situacao: string): boolean {
  return situacao === "prevista";
}
