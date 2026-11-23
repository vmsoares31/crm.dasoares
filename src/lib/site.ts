function base(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function urlCallback(): string {
  return `${base()}/auth/callback`;
}

/** Destino dos e-mails de convite e recuperação (fluxo implícito, tokens no hash). */
export function urlDefinirSenha(): string {
  return `${base()}/definir-senha`;
}

type Cabecalhos = { get(nome: string): string | null };

const primeiro = (v: string | null) => (v ?? "").split(",")[0].trim();
const ehCuringa = (host: string) => /^0\.0\.0\.0(:\d+)?$/.test(host) || /^\[::\](:\d+)?$/.test(host);

/**
 * Origem pública do app para montar redirecionamentos absolutos.
 * Ordem: NEXT_PUBLIC_SITE_URL; x-forwarded-host (+ x-forwarded-proto); origem da requisição
 * (ou o cabeçalho Host, se a origem for o endereço de escuta 0.0.0.0). Nunca devolve 0.0.0.0:
 * atrás de um proxy sem esses cabeçalhos, o servidor standalone vê o HOSTNAME de escuta.
 */
export function origemPublica(cabecalhos: Cabecalhos, origemRequisicao: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (site) return site.replace(/\/+$/, "");

  const req = new URL(origemRequisicao);
  const protoReq = req.protocol.replace(/:$/, "");

  const fwdHost = primeiro(cabecalhos.get("x-forwarded-host"));
  if (fwdHost && !ehCuringa(fwdHost)) {
    const proto = primeiro(cabecalhos.get("x-forwarded-proto")) || protoReq;
    return `${proto}://${fwdHost}`;
  }

  if (!ehCuringa(req.host)) return req.origin;

  const host = primeiro(cabecalhos.get("host"));
  if (host && !ehCuringa(host)) return `${protoReq}://${host}`;
  return `${protoReq}://localhost${req.port ? `:${req.port}` : ""}`;
}

/** URL absoluta (origem pública + caminho com busca opcional). */
export function urlPublica(cabecalhos: Cabecalhos, origemRequisicao: string, caminho: string): URL {
  return new URL(caminho, `${origemPublica(cabecalhos, origemRequisicao)}/`);
}
