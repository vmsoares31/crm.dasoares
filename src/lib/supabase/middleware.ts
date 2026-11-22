import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/db/database.types";

const ROTAS_PUBLICAS = ["/login", "/recuperar-senha", "/api/saude"];

function redirecionar(request: NextRequest, caminho: string, base: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = caminho;
  url.search = "";
  const resposta = NextResponse.redirect(url);
  base.cookies.getAll().forEach((c) => resposta.cookies.set(c));
  return resposta;
}

/** Renova a sessão, exige login e desloga usuários com perfil inativo. */
export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return publica ? resposta : redirecionar(request, "/login", resposta);
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.ativo) {
    await supabase.auth.signOut();
    const saida = redirecionar(request, "/login", resposta);
    saida.cookies.getAll().forEach((c) => {
      if (c.name.startsWith("sb-")) saida.cookies.delete(c.name);
    });
    return saida;
  }

  if (caminho === "/login") return redirecionar(request, "/inicio", resposta);
  return resposta;
}
