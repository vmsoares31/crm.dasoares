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
