/**
 * Integração contra o banco de DESENVOLVIMENTO (que tem clientes reais importados).
 * Só roda com INTEGRACAO=1 e um usuário ativo com permissão financeira:
 *   INTEGRACAO=1 INTEGRACAO_EMAIL=... INTEGRACAO_SENHA=... npx vitest run tests/integracao
 * Requer as migrations 0006, 0007 e 0011 aplicadas.
 *
 * NUNCA apaga tabelas inteiras: cria clientes próprios ("TESTE-INTEGRACAO …") na competência
 * 2099-01, restringe abrir/regerar a esses clientes e, na limpeza, apaga só essas linhas.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/database.types";

const ATIVO = process.env.INTEGRACAO === "1";
const COMPETENCIA = "2099-01";
const PREFIXO = "TESTE-INTEGRACAO";

let supabase: SupabaseClient<Database>;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => supabase,
  createServiceClient: () => { throw new Error("não usado no teste"); },
}));

describe.skipIf(!ATIVO)("competência (integração)", () => {
  let clienteIds: string[] = [];

  async function limparFixtures(ids: string[]) {
    if (ids.length === 0) return;
    // cobrancas → itens e movimentos 'usado' caem em cascata; extras perdem o vínculo
    await supabase.from("cobrancas").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("creditos_movimentos").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("lancamentos_extras").delete().in("cliente_id", ids).throwOnError();
  }

  async function idsDosFixtures(): Promise<string[]> {
    // só "TESTE-INTEGRACAO 1..3": não pega os fixtures de outros arquivos (ex.: "TESTE-INTEGRACAO BAIXA …")
    const { data } = await supabase.from("clientes").select("id").like("razao_social", `${PREFIXO} _`).throwOnError();
    return (data ?? []).map((c) => c.id);
  }

  beforeAll(async () => {
    try { process.loadEnvFile(".env.local"); } catch { /* variáveis já no ambiente */ }
    supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.INTEGRACAO_EMAIL!, password: process.env.INTEGRACAO_SENHA!,
    });
    if (error) throw new Error(`Login do teste falhou: ${error.message}`);

    // sobras de uma execução interrompida (somente linhas com o prefixo de teste)
    const sobras = await idsDosFixtures();
    await limparFixtures(sobras);
    if (sobras.length) {
      await supabase.from("contratos").delete().in("cliente_id", sobras).throwOnError();
      await supabase.from("clientes").delete().in("id", sobras).throwOnError();
    }

    const { data: carteira } = await supabase.from("carteiras").select("id").limit(1).single().throwOnError();
    const { data: clientes } = await supabase
      .from("clientes")
      .insert([1, 2, 3].map((n) => ({ razao_social: `${PREFIXO} ${n}`, situacao: "ativo" })))
      .select("id, razao_social")
      .throwOnError();
    const ordenados = [...(clientes ?? [])].sort((a, b) => a.razao_social.localeCompare(b.razao_social));
    clienteIds = ordenados.map((c) => c.id);
    await supabase
      .from("contratos")
      .insert(clienteIds.map((id) => ({
        cliente_id: id, situacao: "fechado", honorario: 22000, dia_vencimento: 20,
        carteira_id: carteira!.id, tipo_cobranca: "boleto",
      })))
      .throwOnError();
  });

  beforeEach(async () => {
    await limparFixtures(clienteIds);
  });

  afterAll(async () => {
    if (!supabase) return;
    const ids = clienteIds.length ? clienteIds : await idsDosFixtures();
    await limparFixtures(ids);
    if (ids.length) {
      await supabase.from("contratos").delete().in("cliente_id", ids).throwOnError();
      await supabase.from("clientes").delete().in("id", ids).throwOnError();
    }
    await supabase.auth.signOut();
  });

  async function cobrancasDoTeste() {
    const { data } = await supabase.from("cobrancas").select("*").eq("competencia", COMPETENCIA).in("cliente_id", clienteIds).throwOnError();
    return data ?? [];
  }

  it("abrirCompetencia duas vezes → mesmo número de cobranças (sem duplicar)", async () => {
    const { abrirCompetencia } = await import("@/db/cobrancas");
    await abrirCompetencia(COMPETENCIA, { clienteIds });
    expect(await cobrancasDoTeste()).toHaveLength(3);
    const segunda = await abrirCompetencia(COMPETENCIA, { clienteIds });
    expect(segunda.cobrancas).toHaveLength(0);
    expect(await cobrancasDoTeste()).toHaveLength(3);
  });

  it("regerarCompetencia preserva emitidas", async () => {
    const { abrirCompetencia, regerarCompetencia } = await import("@/db/cobrancas");
    await abrirCompetencia(COMPETENCIA, { clienteIds });
    const [c1, c2] = clienteIds;

    const antes = (await cobrancasDoTeste()).find((c) => c.cliente_id === c1)!;
    await supabase.from("cobrancas").update({ situacao: "emitida", emitida_em: new Date().toISOString() }).eq("id", antes.id).throwOnError();
    const emitida = (await cobrancasDoTeste()).find((c) => c.id === antes.id)!;

    const { data: extras } = await supabase
      .from("lancamentos_extras")
      .insert([
        { cliente_id: c1, descricao: "Recálculo de guia", valor: 5000, competencia: COMPETENCIA },
        { cliente_id: c2, descricao: "Recálculo de guia", valor: 5000, competencia: COMPETENCIA },
      ])
      .select("id, cliente_id")
      .throwOnError();
    const x1 = extras!.find((e) => e.cliente_id === c1)!.id;
    const x2 = extras!.find((e) => e.cliente_id === c2)!.id;

    await regerarCompetencia(COMPETENCIA, { clienteIds });

    const depois = await cobrancasDoTeste();
    expect(depois).toHaveLength(3);
    expect(depois.find((c) => c.id === emitida.id)).toEqual(emitida);

    const { data: e1 } = await supabase.from("lancamentos_extras").select("situacao, cobranca_id").eq("id", x1).single().throwOnError();
    expect(e1).toEqual({ situacao: "pendente", cobranca_id: null });
    const cobC2 = depois.find((c) => c.cliente_id === c2)!;
    const { data: e2 } = await supabase.from("lancamentos_extras").select("situacao, cobranca_id").eq("id", x2).single().throwOnError();
    expect(e2).toEqual({ situacao: "incluido", cobranca_id: cobC2.id });
    expect(cobC2.total).toBe(27000);
  });

  it("cancelada pelo “Cancelar” é reemitida ao abrir; excluída do mês não é", async () => {
    const { abrirCompetencia, cancelarCobranca, cancelarCobrancaPrevista } = await import("@/db/cobrancas");
    await abrirCompetencia(COMPETENCIA, { clienteIds });
    const [c1, c2] = clienteIds;
    const doCliente = async (id: string) => (await cobrancasDoTeste()).filter((c) => c.cliente_id === id);

    const k1 = (await doCliente(c1))[0];
    await cancelarCobranca(k1.id, "reemitir");
    const k2 = (await doCliente(c2))[0];
    await cancelarCobrancaPrevista(k2.id, "fora do mês");

    const { data: marcadas } = await supabase.from("cobrancas").select("id, excluida_do_mes").in("id", [k1.id, k2.id]).throwOnError();
    expect(Object.fromEntries((marcadas ?? []).map((m) => [m.id, m.excluida_do_mes]))).toEqual({ [k1.id]: false, [k2.id]: true });

    const r = await abrirCompetencia(COMPETENCIA, { clienteIds });
    expect(r.cobrancas.map((c) => c.clienteId)).toEqual([c1]);
    expect((await doCliente(c1)).map((c) => c.situacao).sort()).toEqual(["cancelada", "prevista"]);
    expect((await doCliente(c2)).map((c) => c.situacao)).toEqual(["cancelada"]);
    // e abrir de novo não duplica a substituta
    expect((await abrirCompetencia(COMPETENCIA, { clienteIds })).cobrancas).toHaveLength(0);
  });

  it("salvar_contrato atualiza a parcela no lugar e não remove parcela já cobrada", async () => {
    const { abrirCompetencia } = await import("@/db/cobrancas");
    const [c1] = clienteIds;
    const { data: k } = await supabase.from("contratos").select("*").eq("cliente_id", c1).single().throwOnError();
    const campos = (total: number) => ({
      situacao: k!.situacao, honorario: k!.honorario, dia_vencimento: k!.dia_vencimento, data_inicio: k!.data_inicio,
      carteira_id: k!.carteira_id, tipo_cobranca: k!.tipo_cobranca, email_cobranca: k!.email_cobranca,
      parcela_adicional_total: total, legado: k!.legado, encerrado_em: k!.encerrado_em,
    });
    const salvar = (total: number, parcelas: unknown[]) =>
      supabase.rpc("salvar_contrato", { p_contrato_id: k!.id, p_campos: campos(total), p_parcelas: parcelas as never, p_motivo: "" });

    try {
      expect((await salvar(12500, [{ mes: 1, valor: 12500, forma: "data_propria", dia: 10 }])).error).toBeNull();
      const { data: [parcela] } = await supabase.from("parcelas_adicionais").select("id").eq("contrato_id", k!.id).throwOnError() as { data: { id: string }[] };
      await abrirCompetencia(COMPETENCIA, { clienteIds: [c1] });
      const avulsa = (await cobrancasDoTeste()).find((c) => c.origem === "parcela_avulsa")!;
      expect(avulsa.parcela_id).toBe(parcela.id);

      // salvar de novo com o id: mesma parcela, cobrança continua vinculada; abrir não duplica
      expect((await salvar(13000, [{ id: parcela.id, mes: 1, valor: 13000, forma: "data_propria", dia: 10 }])).error).toBeNull();
      const { data: depois } = await supabase.from("parcelas_adicionais").select("id, valor").eq("contrato_id", k!.id).throwOnError();
      expect(depois).toEqual([{ id: parcela.id, valor: 13000 }]);
      const { data: cob } = await supabase.from("cobrancas").select("parcela_id").eq("id", avulsa.id).single().throwOnError();
      expect(cob!.parcela_id).toBe(parcela.id);
      expect((await abrirCompetencia(COMPETENCIA, { clienteIds: [c1] })).cobrancas).toHaveLength(0);

      // remover a parcela cobrada falha
      const { error } = await salvar(0, []);
      expect(error?.message).toBe("Parcela já cobrada: cancele a cobrança antes de removê-la.");
    } finally {
      await limparFixtures(clienteIds);
      await salvar(0, []);
    }
  });
});
