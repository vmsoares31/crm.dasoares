/* Uso: npx tsx scripts/criar-admin.ts <email> [nome]
 * Convida o usuário no Supabase Auth e garante perfis(papel=administrador, ativo=true). Idempotente. */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // segue com as variáveis do ambiente
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--senha");
  const senha = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0) {
    if (!senha || senha.length < 8) throw new Error("--senha exige uma senha de pelo menos 8 caracteres.");
    args.splice(i, 2);
  }
  const email = args[0]?.trim();
  const nome = args[1]?.trim() || email?.split("@")[0];
  if (!email || !nome) throw new Error("Uso: npx tsx scripts/criar-admin.ts <email> [nome] [--senha <senha>]");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  if (!chave) throw new Error("SUPABASE_SERVICE_ROLE_KEY vazia em .env.local.");

  const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | undefined;
  for (let pagina = 1; !userId; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (!userId && senha) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Falha ao criar usuário.");
    userId = data.user.id;
    console.log(`Usuário ${email} criado com senha definida.`);
  } else if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "")}/definir-senha`,
    });
    if (error || !data.user) throw error ?? new Error("Falha ao convidar.");
    userId = data.user.id;
    console.log(`Convite enviado para ${email}.`);
  } else {
    console.log(`Usuário ${email} já existe no Auth.`);
  }

  const { error } = await admin
    .from("perfis")
    .upsert({ usuario_id: userId, nome, papel: "administrador", ativo: true });
  if (error) throw error;
  console.log(`Perfil administrador ativo garantido para ${email} (${userId}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
