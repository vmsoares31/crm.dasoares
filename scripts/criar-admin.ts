/* Uso: npx tsx scripts/criar-admin.ts <email> [nome]
 * Convida o usuário no Supabase Auth e garante perfis(papel=administrador, ativo=true). Idempotente. */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // segue com as variáveis do ambiente
}

async function main() {
  const email = process.argv[2]?.trim();
  const nome = process.argv[3]?.trim() || email?.split("@")[0];
  if (!email || !nome) throw new Error("Uso: npx tsx scripts/criar-admin.ts <email> [nome]");

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

  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nome } });
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
