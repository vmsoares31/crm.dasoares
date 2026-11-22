import "server-only";

import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/db/database.types";

function variavel(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não configurada.`);
  }
  return valor;
}

/**
 * Cliente Supabase com a sessão do usuário (cookies), para Server Components,
 * Server Actions e Route Handlers. Respeita RLS.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSsrServerClient<Database>(
    variavel("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    variavel("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component: não pode gravar cookies.
            // O middleware renova a sessão, então pode ser ignorado.
          }
        },
      },
    },
  );
}

/**
 * Cliente Supabase com a service role: ignora RLS. Somente no servidor e apenas
 * para operações administrativas (ex.: criar usuários, scripts de importação).
 */
export function createServiceClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada: preencha em .env.local (Painel do Supabase > Project Settings > API).",
    );
  }

  return createClient<Database>(
    variavel("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    chave,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
