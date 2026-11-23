import { describe, expect, it } from "vitest";

import { parseBRL } from "@/domain/dinheiro";

describe("parseBRL separador decimal", () => {
  it("ponto único com 1-2 dígitos é decimal", () => {
    expect(parseBRL("230.50")).toBe(23050);
    expect(parseBRL("230.5")).toBe(23050);
    expect(parseBRL("R$ 230.50")).toBe(23050);
  });
  it("mantém milhar e vírgula", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL("1.234.567")).toBe(123456700);
    expect(parseBRL("220")).toBe(22000);
    expect(parseBRL("230,50")).toBe(23050);
  });
});
