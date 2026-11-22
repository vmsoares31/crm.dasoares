import { describe, expect, it } from "vitest";

import { pode, alteracaoDeixaSemAdministrador } from "@/domain/permissoes";

describe("pode", () => {
  it("nega ação que o papel não possui", () => {
    expect(pode(["clientes.editar"], "usuarios.gerenciar")).toBe(false);
  });
  it("permite ação que o papel possui", () => {
    expect(pode(["usuarios.gerenciar"], "usuarios.gerenciar")).toBe(true);
  });
  it("nega com lista vazia", () => {
    expect(pode([], "clientes.editar")).toBe(false);
  });
});

describe("alteracaoDeixaSemAdministrador", () => {
  const admin = (id: string, ativo = true) => ({ id, papel: "administrador" as const, ativo });
  const colab = (id: string) => ({ id, papel: "colaborador" as const, ativo: true });

  it("bloqueia rebaixar o único administrador ativo", () => {
    expect(alteracaoDeixaSemAdministrador([admin("a"), colab("b")], "a", { papel: "colaborador" })).toBe(true);
  });
  it("bloqueia desativar o único administrador ativo", () => {
    expect(alteracaoDeixaSemAdministrador([admin("a")], "a", { ativo: false })).toBe(true);
  });
  it("permite quando há outro administrador ativo", () => {
    expect(alteracaoDeixaSemAdministrador([admin("a"), admin("c")], "a", { ativo: false })).toBe(false);
  });
  it("ignora outro administrador inativo", () => {
    expect(alteracaoDeixaSemAdministrador([admin("a"), admin("c", false)], "a", { papel: "colaborador" })).toBe(true);
  });
  it("permite alterar colaborador", () => {
    expect(alteracaoDeixaSemAdministrador([admin("a"), colab("b")], "b", { ativo: false })).toBe(false);
  });
});
