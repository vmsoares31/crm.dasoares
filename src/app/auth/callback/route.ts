import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { urlPublica } from "@/lib/site";
import { createServerClient } from "@/lib/supabase/server";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createServerClient();
  let erro = true;

  if (code) {
    erro = !!(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && tipo && TIPOS.includes(tipo)) {
    erro = !!(await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })).error;
  }

  const destino = erro ? "/login?erro=link" : "/definir-senha";
  return NextResponse.redirect(urlPublica(request.headers, request.nextUrl.origin, destino));
}
