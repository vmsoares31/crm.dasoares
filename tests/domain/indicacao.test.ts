import { describe, expect, it } from "vitest";

import {
  cobrancaQueLibera,
  creditoDaIndicacao,
  deveLiberarCredito,
  primeiraCobranca,
  situacaoAposBaixa,
  situacoesDasIndicacoes,
  type Indicacao,
} from "@/domain/indicacao";
import type { SituacaoCobranca } from "@/domain/tipos";

const indicacao: Indicacao = { id: "i1", indicadorId: "indicador", indicadoId: "indicado" };

describe("situacaoAposBaixa", () => {
  it("valor igual ou maior que o total → paga; menor → paga_parcial", () => {
    expect(situacaoAposBaixa(22000, 22000)).toBe("paga");
    expect(situacaoAposBaixa(22000, 23000)).toBe("paga");
    expect(situacaoAposBaixa(22000, 10000)).toBe("paga_parcial");
  });
});

describe("creditoDaIndicacao", () => {
  it("percentual do honorário do indicado", () => {
    expect(creditoDaIndicacao(30000, 50)).toBe(15000);
    expect(creditoDaIndicacao(22001, 50)).toBe(11001); // meio centavo arredonda para cima
    expect(creditoDaIndicacao(30000, 0)).toBe(0);
  });
});

describe("deveLiberarCredito", () => {
  const paga = { clienteId: "indicado", situacao: "paga" as const };

  it("libera quando paga, primeira cobrança, com indicação e ainda não liberado", () => {
    expect(deveLiberarCredito(paga, true, indicacao, false)).toBe(true);
  });

  it("paga_parcial não libera", () => {
    expect(deveLiberarCredito({ clienteId: "indicado", situacao: "paga_parcial" }, true, indicacao, false)).toBe(false);
  });

  it("não libera se não é a primeira cobrança, sem indicação ou já liberado", () => {
    expect(deveLiberarCredito(paga, false, indicacao, false)).toBe(false);
    expect(deveLiberarCredito(paga, true, null, false)).toBe(false);
    expect(deveLiberarCredito(paga, true, indicacao, true)).toBe(false);
  });

  it("não libera se a indicação é de outro cliente", () => {
    expect(deveLiberarCredito({ clienteId: "outro", situacao: "paga" }, true, indicacao, false)).toBe(false);
  });
});

describe("cobrancaQueLibera (regra única de liberação)", () => {
  const c = (id: string, situacao: SituacaoCobranca, vencimento: string, criadoEm = "2027-01-01T00:00:00Z") =>
    ({ id, situacao, vencimento, criadoEm });

  it("libera quando a mais antiga não cancelada está paga", () => {
    expect(cobrancaQueLibera([c("b", "emitida", "2027-02-20"), c("a", "paga", "2027-01-20")], false)?.id).toBe("a");
  });

  it("não libera se a mais antiga não está paga, mesmo com uma posterior paga", () => {
    expect(cobrancaQueLibera([c("a", "emitida", "2027-01-20"), c("b", "paga", "2027-02-20")], false)).toBeNull();
    expect(cobrancaQueLibera([c("a", "paga_parcial", "2027-01-20")], false)).toBeNull();
  });

  it("cancelada não conta: a seguinte passa a ser a primeira", () => {
    expect(cobrancaQueLibera([c("a", "cancelada", "2027-01-20"), c("b", "paga", "2027-02-20")], false)?.id).toBe("b");
  });

  it("idempotente: já liberado ou sem cobranças → não libera", () => {
    expect(cobrancaQueLibera([c("a", "paga", "2027-01-20")], true)).toBeNull();
    expect(cobrancaQueLibera([], false)).toBeNull();
  });

  it("empate no vencimento: criação, depois id", () => {
    expect(primeiraCobranca([c("b", "paga", "2027-01-20", "2027-01-02"), c("a", "emitida", "2027-01-20", "2027-01-01")])?.id).toBe("a");
    expect(primeiraCobranca([c("b", "paga", "2027-01-20"), c("a", "emitida", "2027-01-20")])?.id).toBe("a");
  });
});

describe("situacoesDasIndicacoes", () => {
  const ind = (id: string, indicadorId: string, liberado: number | null, liberadoEm: string | null = null) =>
    ({ id, indicadorId, liberado, liberadoEm });

  it("sem liberação → aguardando", () => {
    expect(situacoesDasIndicacoes([ind("i1", "A", null)], [])).toEqual({ i1: { situacao: "aguardando", consumido: 0 } });
  });

  it("liberado sem uso → liberado; uso integral → usado; uso parcial → liberado", () => {
    expect(situacoesDasIndicacoes([ind("i1", "A", 15000, "1")], [])).toEqual({ i1: { situacao: "liberado", consumido: 0 } });
    expect(situacoesDasIndicacoes([ind("i1", "A", 15000, "1")], [{ clienteId: "A", tipo: "usado", valor: 15000 }]).i1)
      .toEqual({ situacao: "usado", consumido: 15000 });
    expect(situacoesDasIndicacoes([ind("i1", "A", 15000, "1")], [{ clienteId: "A", tipo: "usado", valor: 10000 }]).i1)
      .toEqual({ situacao: "liberado", consumido: 10000 });
  });

  it("estorno devolve o crédito", () => {
    const r = situacoesDasIndicacoes([ind("i1", "A", 15000, "1")], [
      { clienteId: "A", tipo: "usado", valor: 15000 },
      { clienteId: "A", tipo: "estornado", valor: 15000 },
    ]);
    expect(r.i1.situacao).toBe("liberado");
  });

  it("consumo atribuído por ordem de liberação (FIFO) e por indicador", () => {
    const r = situacoesDasIndicacoes(
      [ind("i2", "A", 10000, "2"), ind("i1", "A", 15000, "1"), ind("i3", "B", 5000, "1")],
      [{ clienteId: "A", tipo: "usado", valor: 20000 }, { clienteId: "A", tipo: "liberado", valor: 25000 }],
    );
    expect(r).toEqual({
      i1: { situacao: "usado", consumido: 15000 },
      i2: { situacao: "liberado", consumido: 5000 },
      i3: { situacao: "liberado", consumido: 0 },
    });
  });
});
