import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dividirPaginas, parsePaginaDominio } from "@/domain/dominio-parser";

const paginas = dividirPaginas(readFileSync("tests/fixtures/dominio-paginas.txt", "utf8"));

describe("parsePaginaDominio", () => {
  it("divide a fixture em 3 páginas", () => {
    expect(paginas).toHaveLength(3);
  });

  it("D.A. Soares", () => {
    const e = parsePaginaDominio(paginas[0]);
    expect(e.codigo).toBe(1);
    expect(e.documento).toBe("01496613000124");
    expect(e.cep).toBe("03319000");
    expect(e.email).toBe("diretoria@dasoares.com.br");
    expect(e.logradouro).toBe("Rua CANTAGALO");
    expect(e.situacao).toBe("Ativa");
    expect(e.socios).toHaveLength(1);
    expect(e.socios[0]).toMatchObject({ nome: "VICTOR MARTINS SOARES", participacao: 100, saida: null });
    expect(e.camposSuspeitos).toEqual([]);
  });

  it("CATITA", () => {
    const e = parsePaginaDominio(paginas[1]);
    expect(e.razaoSocial).toBe("CATITA IMOVEIS LTDA EPP");
    expect(e.bairro).toBe("CIDADE LÍDER");
    expect(e.logradouro).toBe("LÍDER");
    expect(e.documento).toBe("50297225000120");
    expect(e.socios.map((s) => s.nome)).toEqual(["MARIA EXEMPLO DA SILVA", "JOSE EXEMPLO SANTOS"]);
    // coluna esquerda deslocada (e-mail traz um site): dados não confiáveis ficam em branco e sinalizados
    expect(e.email).toBe("");
    expect(e.inscricaoEstadual).toBe("");
    expect(e.inscricaoMunicipal).toBe("");
    expect(e.telefone).toBe("");
    expect(e.camposSuspeitos).toEqual(
      expect.arrayContaining(["email", "endereco", "inscricao_estadual", "inscricao_municipal", "telefone"]),
    );
  });

  it("QUARTTO STAY: e-mail com CNPJ vira suspeito e sócios com saída são datados", () => {
    const e = parsePaginaDominio(paginas[2]);
    expect(e.email).toBe("");
    expect(e.camposSuspeitos).toEqual(
      expect.arrayContaining(["email", "endereco", "inscricao_estadual", "inscricao_municipal", "telefone"]),
    );
    expect(e.documento).toBe("61431938000150");
    expect(e.socios).toHaveLength(5);
    const ativos = e.socios.filter((s) => s.saida === null).map((s) => s.nome);
    expect(ativos).toEqual(["PEDRO HENRIQUE MARTINS SOARES", "BEATRIZ MORAES DE MELO CAUTELLA"]);
    expect(e.socios.find((s) => s.nome === "ANA FICTICIA ARAUJO")?.saida).toBe("2025-12-31");
    expect(e.socios.find((s) => s.nome === "PEDRO HENRIQUE MARTINS SOARES")?.participacao).toBe(50);
  });
});

describe("sócios com data de saída inválida", () => {
  it("não importa como ativo e sinaliza", () => {
    const pagina = paginas[0].replace("00/00/0000", "31/02/2025");
    const e = parsePaginaDominio(pagina);
    expect(e.socios).toHaveLength(0);
    expect(e.camposSuspeitos).toContain("socio_saida");
  });
  it("página sem situação é sinalizada", () => {
    const e = parsePaginaDominio(paginas[0].replace(/[ ]+Ativa[ ]*$/m, ""));
    expect(e.situacao).toBeNull();
    expect(e.camposSuspeitos).toContain("situacao");
  });
});
