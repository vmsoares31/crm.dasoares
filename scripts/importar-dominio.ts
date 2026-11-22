/* Uso: npx tsx scripts/importar-dominio.ts <relatorio.txt> [--dry]
 * Importa o relatório "Empresas – Dados Cadastrais" do Domínio (pdftotext -layout -enc UTF-8) em `clientes`/`socios`.
 * Idempotente: upsert por documento; só reescreve clientes ainda 'a_revisar' (confirmados nunca são tocados). */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dividirPaginas, parsePaginaDominio, type EmpresaImportada } from "../src/domain/dominio-parser";

try {
  process.loadEnvFile(".env.local");
} catch {
  // segue com as variáveis do ambiente
}

const DOC_ESCRITORIO = "01496613000124";
const vazio = (s: string) => (s === "" ? null : s);

function linhaCliente(e: EmpresaImportada) {
  return {
    codigo_dominio: e.codigo || null,
    razao_social: e.razaoSocial,
    nome_fantasia: vazio(e.nomeFantasia),
    documento: vazio(e.documento),
    logradouro: vazio(e.logradouro),
    numero: vazio(e.numero),
    complemento: vazio(e.complemento),
    bairro: vazio(e.bairro),
    cidade: vazio(e.cidade),
    uf: vazio(e.uf),
    cep: vazio(e.cep),
    telefone: vazio(e.telefone),
    email: vazio(e.email),
    inscricao_estadual: vazio(e.inscricaoEstadual),
    inscricao_municipal: vazio(e.inscricaoMunicipal),
    campos_suspeitos: e.camposSuspeitos,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const caminho = args.find((a) => !a.startsWith("--"));
  if (!caminho) throw new Error("Uso: npx tsx scripts/importar-dominio.ts <relatorio.txt> [--dry]");

  const paginas = dividirPaginas(readFileSync(caminho, "utf8"));
  const empresas = paginas.map(parsePaginaDominio);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dry && (!url || !chave)) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local.");
  const db = dry ? null : createClient(url!, chave!, { auth: { persistSession: false, autoRefreshToken: false } });

  const r = { paginas: paginas.length, novos: 0, atualizados: 0, inativos: 0, suspeitos: 0, confirmados: 0, ignorados: [] as string[] };

  for (const e of empresas) {
    const nome = `${e.codigo} - ${e.razaoSocial}`;
    if (e.documento === DOC_ESCRITORIO) {
      r.ignorados.push(`${nome}: escritório (já semeado)`);
      continue;
    }
    if (!e.razaoSocial) {
      r.ignorados.push(`${nome}: sem razão social`);
      continue;
    }
    const inativo = e.situacao === "Inativa";
    if (inativo) r.inativos++;
    if (e.camposSuspeitos.length) r.suspeitos++;
    if (!db) continue;

    // localiza por documento (ou, sem documento, pelo código do Domínio)
    const q = db.from("clientes").select("id, situacao");
    const { data: existente, error: eBusca } = await (e.documento
      ? q.eq("documento", e.documento)
      : q.eq("codigo_dominio", e.codigo)
    ).maybeSingle();
    if (eBusca) throw new Error(`${nome}: ${eBusca.message}`);

    let clienteId: string;
    if (existente) {
      if (existente.situacao !== "a_revisar") {
        r.confirmados++;
        continue;
      }
      const { error } = await db.from("clientes").update({ ...linhaCliente(e), situacao: inativo ? "inativo" : "a_revisar" }).eq("id", existente.id);
      if (error) throw new Error(`${nome}: ${error.message}`);
      clienteId = existente.id;
      r.atualizados++;
      const { error: eDel } = await db.from("socios").delete().eq("cliente_id", clienteId);
      if (eDel) throw new Error(`${nome} (sócios): ${eDel.message}`);
    } else {
      const { data, error } = await db
        .from("clientes")
        .insert({ ...linhaCliente(e), situacao: inativo ? "inativo" : "a_revisar" })
        .select("id")
        .single();
      if (error) throw new Error(`${nome}: ${error.message}`);
      clienteId = data.id;
      r.novos++;
    }

    const socios = e.socios
      .filter((s) => s.saida === null)
      .map((s) => ({ cliente_id: clienteId, nome: s.nome, cpf: s.cpf, participacao: s.participacao }));
    if (socios.length) {
      const { error } = await db.from("socios").insert(socios);
      if (error) throw new Error(`${nome} (sócios): ${error.message}`);
    }
  }

  console.log(dry ? "[DRY-RUN: nada gravado]" : "Importação concluída.");
  console.log(`Páginas: ${r.paginas}`);
  console.log(`Importados: ${r.novos} novos, ${r.atualizados} atualizados`);
  console.log(`Inativos: ${r.inativos}`);
  console.log(`Com campos suspeitos: ${r.suspeitos}`);
  console.log(`Já confirmados (não tocados): ${r.confirmados}`);
  console.log(`Ignorados: ${r.ignorados.length}`);
  for (const i of r.ignorados) console.log(`  - ${i}`);
  const semDoc = empresas.filter((e) => !e.documento).length;
  const semSit = empresas.filter((e) => e.situacao === null).length;
  console.log(`(sem documento válido: ${semDoc}; sem situação: ${semSit}; ativas: ${empresas.filter((e) => e.situacao === "Ativa").length})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
