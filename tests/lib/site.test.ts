import { afterEach, describe, expect, it, vi } from "vitest";

import { origemPublica, urlPublica } from "@/lib/site";

const cabecalhos = (h: Record<string, string>) => new Headers(h);

describe("origemPublica", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("usa NEXT_PUBLIC_SITE_URL quando definida (sem barra final)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.exemplo.com.br/");
    expect(origemPublica(cabecalhos({ "x-forwarded-host": "outro.com" }), "http://0.0.0.0:3000")).toBe("https://crm.exemplo.com.br");
  });

  it("sem a variável, usa x-forwarded-host e x-forwarded-proto", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(origemPublica(cabecalhos({ "x-forwarded-host": "crm.exemplo.com.br", "x-forwarded-proto": "https" }), "http://0.0.0.0:3000"))
      .toBe("https://crm.exemplo.com.br");
    // proxies em cadeia: vale o primeiro valor
    expect(origemPublica(cabecalhos({ "x-forwarded-host": "a.com, b.com", "x-forwarded-proto": "https,http" }), "http://0.0.0.0:3000"))
      .toBe("https://a.com");
  });

  it("x-forwarded-host sem proto assume o protocolo da requisição", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(origemPublica(cabecalhos({ "x-forwarded-host": "crm.local:8080" }), "http://0.0.0.0:3000")).toBe("http://crm.local:8080");
  });

  it("sem variável nem cabeçalhos, usa a origem da requisição", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(origemPublica(cabecalhos({}), "http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("nunca devolve 0.0.0.0", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(origemPublica(cabecalhos({ host: "crm.interno:3000" }), "http://0.0.0.0:3000")).toBe("http://crm.interno:3000");
    expect(origemPublica(cabecalhos({ host: "0.0.0.0:3000" }), "http://0.0.0.0:3000")).toBe("http://localhost:3000");
    expect(origemPublica(cabecalhos({ "x-forwarded-host": "0.0.0.0:3000" }), "http://0.0.0.0:3000")).toBe("http://localhost:3000");
  });

  it("urlPublica monta URL absoluta com caminho e busca", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.exemplo.com.br");
    expect(urlPublica(cabecalhos({}), "http://0.0.0.0:3000", "/login?erro=link").toString()).toBe("https://crm.exemplo.com.br/login?erro=link");
  });
});
