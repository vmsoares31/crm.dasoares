/**
 * Integração contra o banco de DESENVOLVIMENTO (que tem clientes reais importados).
 * Só roda com INTEGRACAO=1 e um usuário ativo com permissão de clientes e financeiro:
 *   INTEGRACAO=1 INTEGRACAO_EMAIL=... INTEGRACAO_SENHA=... npx vitest run tests/integracao/indicacoes.test.ts
 * Requer as migrations 0006 a 0010 aplicadas e escritorio.indicacao_pct = 50.
 *
 * NUNCA apaga tabelas inteiras: cria clientes próprios ("TESTE-INTEGRACAO IND …", que não
 * casam com os padrões "TESTE-INTEGRACAO _" e "TESTE-INTEGRACAO BAIXA%" dos outros arquivos)
 * com cobranças nas competências 2099-xx e, na limpeza, apaga só essas linhas.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/database.types";
import { hojeSP } from "@/domain/datas";

const PREFIXO = "TESTE-INTEGRACAO IND";

let supabase: SupabaseClient<Database>;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => supabase,
  createServiceClient: () => { throw new Error("não usado no teste"); },
}));

describe.skipIf(process.env.INTEGRACAO !== "1")("indicações e extrato de crédito (integração)", () => {
  let indicadorId = "";
  let indicadoId = "";
  let semContratoId = "";
  let contratoIndicado = "";

  async function idsDosFixtures(): Promise<string[]> {
    const { data } = await supabase.from("clientes").select("id").like("razao_social", `${PREFIXO} %`).throwOnError();
    return (data ?? []).map((c) => c.id);
  }

  /** Apaga só o movimento dos clientes de teste (pagamentos antes, por causa do ON DELETE RESTRICT). */
  async function limparMovimento(ids: string[]) {
    if (ids.length === 0) return;
    const { data: cobs } = await supabase.from("cobrancas").select("id").in("cliente_id", ids).throwOnError();
    const cobIds = (cobs ?? []).map((c) => c.id);
    if (cobIds.length) await supabase.from("pagamentos").delete().in("cobranca_id", cobIds).throwOnError();
    await supabase.from("creditos_movimentos").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("cobrancas").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("indicacoes").delete().in("indicado_id", ids).throwOnError();
    await supabase.from("clientes").update({ indicado_por: null }).in("id", ids).throwOnError();
  }

  async function limparTudo(ids: string[]) {
    if (ids.length === 0) return;
    await limparMovimento(ids);
    await supabase.from("contratos").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("clientes").delete().in("id", ids).throwOnError();
  }

  async function criarCobranca(vencimento: string, situacao: string): Promise<string> {
    const { data } = await supabase
      .from("cobrancas")
      .insert({
        cliente_id: indicadoId, contrato_id: contratoIndicado, competencia: vencimento.slice(0, 7), origem: "mensal",
        vencimento, total: 30000, situacao, descricao: "teste",
      })
      .select("id")
      .single()
      .throwOnError();
    await supabase.from("cobranca_itens")
      .insert({ cobranca_id: data!.id, tipo: "mensalidade", descricao: "Mensalidade", valor: 30000 }).throwOnError();
    return data!.id;
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

    await limparTudo(await idsDosFixtures()); // sobras de uma execução interrompida

    const { data: carteira } = await supabase.from("carteiras").select("id").limit(1).single().throwOnError();
    const { data: clientes } = await supabase
      .from("clientes")
      .insert(["indicador", "indicado", "sem contrato"].map((n) => ({ razao_social: `${PREFIXO} ${n}`, situacao: "ativo" })))
      .select("id, razao_social")
      .throwOnError();
    const id = (n: string) => clientes!.find((c) => c.razao_social === `${PREFIXO} ${n}`)!.id;
    indicadorId = id("indicador");
    indicadoId = id("indicado");
    semContratoId = id("sem contrato");

    const { data: contrato } = await supabase
      .from("contratos")
      .insert({ cliente_id: indicadoId, situacao: "fechado", honorario: 30000, dia_vencimento: 20, carteira_id: carteira!.id, tipo_cobranca: "boleto" })
      .select("id")
      .single()
      .throwOnError();
    contratoIndicado = contrato!.id;
  });

  beforeEach(async () => {
    await limparMovimento([indicadorId, indicadoId, semContratoId].filter(Boolean));
  });

  afterAll(async () => {
    if (!supabase) return;
    const ids = [indicadorId, indicadoId, semContratoId].filter(Boolean);
    await limparTudo(ids.length ? ids : await idsDosFixtures());
    await supabase.auth.signOut();
  });

  it("indicar cliente sem contrato → erro", async () => {
    const { registrarIndicacao } = await import("@/db/indicacoes");
    await expect(registrarIndicacao(indicadorId, semContratoId)).rejects.toThrow("Indicado precisa ter contrato com honorário");
  });

  it("indicar o próprio cliente → erro", async () => {
    const { registrarIndicacao } = await import("@/db/indicacoes");
    await expect(registrarIndicacao(indicadoId, indicadoId)).rejects.toThrow("Um cliente não pode indicar a si mesmo.");
  });

  it("caso válido → 'gerado' 15000, indicado_por gravado e saldo disponível 0 até a liberação", async () => {
    const { extratoCredito, listarIndicacoes, registrarIndicacao } = await import("@/db/indicacoes");
    const r = await registrarIndicacao(indicadorId, indicadoId);
    expect(r).toMatchObject({ gerado: 15000, liberado: 0 });

    const extrato = await extratoCredito(indicadorId);
    expect(extrato.movimentos).toHaveLength(1);
    expect(extrato.movimentos[0]).toMatchObject({ tipo: "gerado", valor: 15000, indicado: { id: indicadoId } });
    expect(extrato.saldoDisponivel).toBe(0);
    expect(extrato.aLiberar).toBe(15000);

    const { data: c } = await supabase.from("clientes").select("indicado_por").eq("id", indicadoId).single().throwOnError();
    expect(c!.indicado_por).toBe(indicadorId);

    const linhas = await listarIndicacoes({ clienteId: indicadorId });
    expect(linhas).toEqual([expect.objectContaining({ id: r.indicacaoId, valor: 15000, situacao: "aguardando" })]);
  });

  it("indicado já indicado → erro", async () => {
    const { registrarIndicacao } = await import("@/db/indicacoes");
    await registrarIndicacao(indicadorId, indicadoId);
    await expect(registrarIndicacao(semContratoId, indicadoId)).rejects.toThrow("Este cliente já foi indicado.");
  });

  it("1ª cobrança já paga antes do registro → libera na hora", async () => {
    const { extratoCredito, registrarIndicacao } = await import("@/db/indicacoes");
    await criarCobranca("2099-02-20", "paga");
    const r = await registrarIndicacao(indicadorId, indicadoId);
    expect(r).toMatchObject({ gerado: 15000, liberado: 15000 });
    expect((await extratoCredito(indicadorId)).saldoDisponivel).toBe(15000);
  });

  it("cancelar a 1ª cobrança em aberto quando a seguinte já está paga → libera (crédito não se perde)", async () => {
    const { cancelarCobranca, registrarBaixa } = await import("@/db/cobrancas");
    const { extratoCredito, listarIndicacoes, registrarIndicacao } = await import("@/db/indicacoes");
    await registrarIndicacao(indicadorId, indicadoId);
    const primeira = await criarCobranca("2099-02-20", "emitida");
    const segunda = await criarCobranca("2099-03-20", "emitida");

    expect(await registrarBaixa(segunda, hojeSP(), 30000)).toMatchObject({ situacao: "paga", creditoLiberado: 0 });
    expect((await extratoCredito(indicadorId)).saldoDisponivel).toBe(0);

    await cancelarCobranca(primeira, "teste de reavaliação");
    const extrato = await extratoCredito(indicadorId);
    expect(extrato.saldoDisponivel).toBe(15000);
    expect(extrato.movimentos.filter((m) => m.tipo === "liberado")).toEqual([expect.objectContaining({ valor: 15000, cobrancaId: segunda })]);
    expect((await listarIndicacoes({ clienteId: indicadoId }))[0].situacao).toBe("liberado");

    // reavaliar de novo não libera duas vezes
    const { data: ind } = await supabase.from("indicacoes").select("id").eq("indicado_id", indicadoId).single().throwOnError();
    const { data: denovo } = await supabase.rpc("reavaliar_credito_indicacao", { p_indicacao_id: ind!.id }).throwOnError();
    expect(Number(denovo)).toBe(0);
    expect((await extratoCredito(indicadorId)).saldoDisponivel).toBe(15000);
  });

  it("baixar indicação aguardando → a 1ª cobrança paga depois não libera crédito", async () => {
    const { baixarIndicacao, extratoCredito, listarIndicacoes, registrarIndicacao } = await import("@/db/indicacoes");
    const { registrarBaixa } = await import("@/db/cobrancas");
    const { indicacaoId } = await registrarIndicacao(indicadorId, indicadoId);
    await expect(baixarIndicacao(indicacaoId, "  ")).rejects.toThrow("Informe o motivo.");
    await baixarIndicacao(indicacaoId, "indicado nunca pagou");
    await expect(baixarIndicacao(indicacaoId, "de novo")).rejects.toThrow("Indicação já baixada.");

    const cobranca = await criarCobranca("2099-02-20", "emitida");
    expect(await registrarBaixa(cobranca, hojeSP(), 30000)).toMatchObject({ situacao: "paga", creditoLiberado: 0 });
    const { data: reav } = await supabase.rpc("reavaliar_credito_indicacao", { p_indicacao_id: indicacaoId }).throwOnError();
    expect(Number(reav)).toBe(0);

    const extrato = await extratoCredito(indicadorId);
    expect(extrato.saldoDisponivel).toBe(0);
    expect(extrato.movimentos.filter((m) => m.tipo === "liberado")).toHaveLength(0);
    expect(extrato.aLiberar).toBe(0);
    expect((await listarIndicacoes({ clienteId: indicadorId }))[0]).toMatchObject({
      situacao: "baixada", baixa: expect.objectContaining({ motivo: "indicado nunca pagou" }),
    });
  });

  it("baixar depois de liberado → erro", async () => {
    const { baixarIndicacao, registrarIndicacao } = await import("@/db/indicacoes");
    await criarCobranca("2099-02-20", "paga");
    const { indicacaoId, liberado } = await registrarIndicacao(indicadorId, indicadoId);
    expect(liberado).toBe(15000);
    await expect(baixarIndicacao(indicacaoId, "tarde demais")).rejects.toThrow("Crédito já liberado: a indicação não pode ser baixada.");
  });
});
