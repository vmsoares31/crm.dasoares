import { describe, expect, it } from "vitest";

import {
  planejarCompetencia, saldoDeCredito, validarEdicaoItens,
  type CobrancaExistente, type DadosCompetencia, type ExtraDaCompetencia, type MovimentoCredito, type PlanoCompetencia,
} from "@/domain/competencia";
import type { ContratoFechamento } from "@/domain/fechamento";
import type { ItemCobranca } from "@/domain/tipos";

const contrato = (n: number, o: Partial<ContratoFechamento> = {}): ContratoFechamento => ({
  clienteId: `c${n}`, contratoId: `k${n}`, clienteNome: `Cliente ${n}`, honorario: 22000, diaVencimento: 20,
  carteiraId: "w1", tipoCobranca: "boleto", parcelas: [], ...o,
});
const extra = (id: string, clienteId: string, o: Partial<ExtraDaCompetencia> = {}): ExtraDaCompetencia => ({
  id, clienteId, descricao: "Recálculo de guia", valor: 5000, competencia: "2099-01", situacao: "pendente", cobrancaId: null, ...o,
});

/** Estado em memória que imita o banco e a RPC gravar_competencia. */
type Estado = { cobrancas: CobrancaExistente[]; extras: ExtraDaCompetencia[]; movimentos: MovimentoCredito[]; seq: number };

function dados(e: Estado, contratos: ContratoFechamento[], regerar: boolean): DadosCompetencia {
  return { competencia: "2099-01", regerar, contratos, cobrancasExistentes: e.cobrancas, extras: e.extras, movimentos: e.movimentos };
}

function gravar(e: Estado, plano: PlanoCompetencia): Estado {
  const removidas = new Set(plano.removidas);
  let { seq } = e;
  const cobrancas = e.cobrancas.filter((c) => !removidas.has(c.id));
  const extras = e.extras.map((x) => (x.cobrancaId && removidas.has(x.cobrancaId) ? { ...x, situacao: "pendente" as const, cobrancaId: null } : x));
  const movimentos = e.movimentos.filter((m) => !(m.cobrancaId && removidas.has(m.cobrancaId)));
  for (const c of plano.cobrancas) {
    const id = `cob${++seq}`;
    cobrancas.push({ id, clienteId: c.clienteId, contratoId: c.contratoId, origem: c.origem, parcelaId: c.parcelaId, situacao: c.situacao });
    for (const it of c.itens.filter((i) => i.tipo === "extra")) {
      const i = extras.findIndex((x) => x.id === it.refId);
      expect(extras[i].situacao).toBe("pendente");
      extras[i] = { ...extras[i], situacao: "incluido", cobrancaId: id };
    }
    if (c.creditoUsado > 0) movimentos.push({ clienteId: c.clienteId, tipo: "usado", valor: c.creditoUsado, cobrancaId: id });
  }
  return { cobrancas, extras, movimentos, seq };
}

const vazio = (): Estado => ({ cobrancas: [], extras: [], movimentos: [], seq: 0 });

describe("planejarCompetencia — cenários do brief", () => {
  it("abrir duas vezes não duplica cobranças", () => {
    const contratos = [contrato(1), contrato(2, { parcelas: [{ id: "p1", mes: 1, valor: 12500, forma: "data_propria", dia: 10 }] })];
    const e1 = gravar(vazio(), planejarCompetencia(dados(vazio(), contratos, false)));
    expect(e1.cobrancas).toHaveLength(3);
    const p2 = planejarCompetencia(dados(e1, contratos, false));
    expect(p2.cobrancas).toHaveLength(0);
    expect(p2.removidas).toHaveLength(0);
    expect(p2.mantidas).toHaveLength(3);
    expect(gravar(e1, p2).cobrancas).toHaveLength(3);
  });

  it("regerarCompetencia preserva emitidas", () => {
    const contratos = [contrato(1), contrato(2), contrato(3)];
    let e = gravar(vazio(), planejarCompetencia(dados(vazio(), contratos, false)));
    expect(e.cobrancas).toHaveLength(3);
    // emitir a do cliente 1
    const emitida = e.cobrancas.find((c) => c.clienteId === "c1")!;
    e = { ...e, cobrancas: e.cobrancas.map((c) => (c.id === emitida.id ? { ...c, situacao: "emitida" as const } : c)) };
    // extras novos para o cliente emitido e para outro
    e = { ...e, extras: [...e.extras, extra("x1", "c1"), extra("x2", "c2")] };

    const plano = planejarCompetencia(dados(e, contratos, true));
    expect(plano.removidas).toHaveLength(2);
    expect(plano.removidas).not.toContain(emitida.id);
    expect(plano.cobrancas.map((c) => c.clienteId).sort()).toEqual(["c2", "c3"]);
    e = gravar(e, plano);

    expect(e.cobrancas).toHaveLength(3);
    expect(e.cobrancas.find((c) => c.id === emitida.id)).toEqual({ ...emitida, situacao: "emitida" });
    expect(e.extras.find((x) => x.id === "x1")).toMatchObject({ situacao: "pendente", cobrancaId: null });
    const doC2 = e.cobrancas.find((c) => c.clienteId === "c2")!;
    expect(e.extras.find((x) => x.id === "x2")).toMatchObject({ situacao: "incluido", cobrancaId: doC2.id });
  });
});

describe("planejarCompetencia — regras", () => {
  it("ao abrir, cobrança prevista existente é mantida e extra novo do cliente fica pendente", () => {
    const contratos = [contrato(1)];
    let e = gravar(vazio(), planejarCompetencia(dados(vazio(), contratos, false)));
    e = { ...e, extras: [extra("x1", "c1")] };
    const p = planejarCompetencia(dados(e, contratos, false));
    expect(p.cobrancas).toHaveLength(0);
  });

  it("regerar refaz prevista incluindo de novo os extras que estavam nela", () => {
    const contratos = [contrato(1)];
    let e: Estado = { ...vazio(), extras: [extra("x1", "c1")] };
    e = gravar(e, planejarCompetencia(dados(e, contratos, false)));
    expect(e.extras[0].situacao).toBe("incluido");
    const p = planejarCompetencia(dados(e, contratos, true));
    expect(p.removidas).toHaveLength(1);
    expect(p.cobrancas[0].itens.map((i) => i.refId)).toContain("x1");
    expect(p.cobrancas[0].total).toBe(27000);
  });

  it("só considera extras pendentes da própria competência", () => {
    const e: Estado = {
      ...vazio(),
      extras: [
        extra("ok", "c1"),
        extra("outroMes", "c1", { competencia: "2099-02" }),
        extra("cancelado", "c1", { situacao: "cancelado" }),
        extra("deOutraCobranca", "c1", { situacao: "incluido", cobrancaId: "emitidaX" }),
      ],
    };
    const p = planejarCompetencia(dados(e, [contrato(1)], true));
    expect(p.cobrancas[0].itens.filter((i) => i.tipo === "extra").map((i) => i.refId)).toEqual(["ok"]);
  });

  it("extras de cliente não gerado continuam pendentes (não entram em cobrança)", () => {
    const contratos = [contrato(1, { honorario: null })];
    let e: Estado = { ...vazio(), extras: [extra("x1", "c1")] };
    const p = planejarCompetencia(dados(e, contratos, false));
    expect(p.cobrancas).toHaveLength(0);
    expect(p.naoGerados).toEqual([{ clienteId: "c1", clienteNome: "Cliente 1", motivo: "Falta: honorário" }]);
    e = gravar(e, p);
    expect(e.extras[0].situacao).toBe("pendente");
  });

  it("regerar mantém cobrança cancelada, paga e paga_parcial", () => {
    const contratos = [contrato(1), contrato(2), contrato(3)];
    const existentes: CobrancaExistente[] = (["cancelada", "paga", "paga_parcial"] as const).map((s, i) => ({
      id: `e${i + 1}`, clienteId: `c${i + 1}`, contratoId: `k${i + 1}`, origem: "mensal", parcelaId: null, situacao: s,
    }));
    const p = planejarCompetencia({ ...dados(vazio(), contratos, true), cobrancasExistentes: existentes });
    expect(p.removidas).toEqual([]);
    expect(p.cobrancas).toHaveLength(0);
  });

  it("parcela avulsa sem cobrança é gerada mesmo com mensal emitida", () => {
    const contratos = [contrato(1, { parcelas: [{ id: "p1", mes: 1, valor: 12500, forma: "data_propria", dia: 5 }] })];
    const existentes: CobrancaExistente[] = [{ id: "e1", clienteId: "c1", contratoId: "k1", origem: "mensal", parcelaId: null, situacao: "emitida" }];
    const p = planejarCompetencia({ ...dados(vazio(), contratos, true), cobrancasExistentes: existentes });
    expect(p.cobrancas).toHaveLength(1);
    expect(p.cobrancas[0]).toMatchObject({ origem: "parcela_avulsa", parcelaId: "p1" });
  });

  it("regerar devolve ao saldo o crédito usado pela prevista apagada", () => {
    const contratos = [contrato(1)];
    let e: Estado = { ...vazio(), movimentos: [{ clienteId: "c1", tipo: "liberado", valor: 15000, cobrancaId: null }] };
    e = gravar(e, planejarCompetencia(dados(e, contratos, false)));
    expect(e.movimentos.filter((m) => m.tipo === "usado")).toHaveLength(1);
    const p = planejarCompetencia(dados(e, contratos, true));
    expect(p.cobrancas[0]).toMatchObject({ creditoUsado: 15000, total: 7000 });
    e = gravar(e, p);
    expect(saldoDeCredito(e.movimentos).c1).toBe(0);
  });

  it("crédito não é usado por cobrança mantida (emitida)", () => {
    const contratos = [contrato(1)];
    const existentes: CobrancaExistente[] = [{ id: "e1", clienteId: "c1", contratoId: "k1", origem: "mensal", parcelaId: null, situacao: "emitida" }];
    const p = planejarCompetencia({
      ...dados(vazio(), contratos, true), cobrancasExistentes: existentes,
      movimentos: [{ clienteId: "c1", tipo: "liberado", valor: 15000, cobrancaId: null }],
    });
    expect(p.cobrancas).toHaveLength(0);
  });
});

describe("saldoDeCredito", () => {
  it("liberado − usado + estornado; gerado não conta", () => {
    expect(saldoDeCredito([
      { clienteId: "a", tipo: "gerado", valor: 15000, cobrancaId: null },
      { clienteId: "a", tipo: "liberado", valor: 15000, cobrancaId: null },
      { clienteId: "a", tipo: "usado", valor: 15000, cobrancaId: "x" },
      { clienteId: "a", tipo: "estornado", valor: 15000, cobrancaId: "x" },
      { clienteId: "b", tipo: "gerado", valor: 9000, cobrancaId: null },
    ])).toEqual({ a: 15000 });
  });
});

describe("validarEdicaoItens", () => {
  const antigos: ItemCobranca[] = [
    { tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 },
    { tipo: "extra", descricao: "Recálculo", valor: 5000, refId: "x1" },
    { tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -15000 },
  ];

  it("altera valor, remove extra vinculado e inclui item avulso", () => {
    const r = validarEdicaoItens(antigos, [
      { tipo: "mensalidade", descricao: " Mensalidade ", valor: 25000 },
      { tipo: "extra", descricao: "Certidão", valor: 3000 },
      { tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -15000 },
    ]);
    expect(r).toMatchObject({ total: 13000, extrasLiberados: ["x1"] });
    if ("itens" in r) expect(r.descricao).toBe("Mensalidade R$ 250,00 + Certidão R$ 30,00 − Desconto indicação R$ 150,00");
  });

  it("não permite mexer no desconto de indicação", () => {
    expect(validarEdicaoItens(antigos, antigos.filter((i) => i.tipo !== "desconto_indicacao"))).toHaveProperty("erro");
  });

  it("não permite vincular extra que não estava na cobrança", () => {
    expect(validarEdicaoItens(antigos, [...antigos, { tipo: "extra", descricao: "Outro", valor: 100, refId: "x9" }])).toHaveProperty("erro");
  });

  it("rejeita total abaixo do mínimo com desconto, total zero e valor negativo", () => {
    expect(validarEdicaoItens(antigos, [
      { tipo: "mensalidade", descricao: "Mensalidade", valor: 16000 },
      { tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -15000 },
    ])).toHaveProperty("erro");
    expect(validarEdicaoItens([], [{ tipo: "mensalidade", descricao: "M", valor: 0 }])).toHaveProperty("erro");
    expect(validarEdicaoItens([], [{ tipo: "extra", descricao: "M", valor: -1 }])).toHaveProperty("erro");
    expect(validarEdicaoItens([], [])).toHaveProperty("erro");
  });
});
