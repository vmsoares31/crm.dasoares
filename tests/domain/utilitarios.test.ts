import { describe, expect, it } from "vitest";
import {
  formatarBRL,
  formatarValorCora,
  parseBRL,
  arredondarParaCimaReal,
  aplicarPercentual,
} from "@/domain/dinheiro";
import { dataVencimento, formatarData, dataPorExtenso, hojeSP } from "@/domain/datas";
import { cpfValido, cnpjValido, somenteDigitos, formatarDocumento } from "@/domain/documentos";
import { valorPorExtenso } from "@/domain/extenso";

describe("dinheiro", () => {
  it("formata", () => {
    expect(formatarBRL(125000)).toBe("R$ 1.250,00");
    expect(formatarBRL(-15000)).toBe("-R$ 150,00");
    expect(formatarBRL(5)).toBe("R$ 0,05");
    expect(formatarBRL(123456789)).toBe("R$ 1.234.567,89");
    expect(formatarValorCora(125000)).toBe("1250,00");
    expect(parseBRL("1.250,00")).toBe(125000);
    expect(parseBRL("R$ 1.250,5")).toBe(125050);
    expect(parseBRL("220")).toBe(22000);
  });
  it("arredonda e aplica percentual", () => {
    expect(arredondarParaCimaReal(5237)).toBe(5300);
    expect(arredondarParaCimaReal(5300)).toBe(5300);
    expect(aplicarPercentual(30000, 50)).toBe(15000);
    expect(aplicarPercentual(22000, 5.5)).toBe(1210);
  });
});

describe("datas", () => {
  it("vencimento", () => {
    expect(dataVencimento("2027-02", 31)).toBe("2027-02-28");
    expect(dataVencimento("2026-11", null)).toBe("2026-11-30");
    expect(dataVencimento("2027-01", 20)).toBe("2027-01-20");
  });
  it("formata", () => {
    expect(formatarData("2027-01-20")).toBe("20/01/2027");
    expect(dataPorExtenso("2026-08-01")).toBe("01 de agosto de 2026");
    expect(hojeSP()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("documentos", () => {
  it("valida", () => {
    expect(cnpjValido("22.184.118/0001-50")).toBe(true);
    expect(cnpjValido("61.431.938/0001-51")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cpfValido("384.992.448-31")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
  it("formata", () => {
    expect(somenteDigitos("22.184.118/0001-50")).toBe("22184118000150");
    expect(formatarDocumento("22184118000150")).toBe("22.184.118/0001-50");
    expect(formatarDocumento("38499244831")).toBe("384.992.448-31");
  });
});

describe("extenso", () => {
  it("valor", () => {
    expect(valorPorExtenso(22000)).toBe("duzentos e vinte reais");
    expect(valorPorExtenso(25050)).toBe("duzentos e cinquenta reais e cinquenta centavos");
  });
});
