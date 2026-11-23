import { describe, expect, it } from "vitest";

import { creditoDaIndicacao, deveLiberarCredito, situacaoAposBaixa, type Indicacao } from "@/domain/indicacao";

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
