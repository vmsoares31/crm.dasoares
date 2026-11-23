/**
 * Integração contra o banco de DESENVOLVIMENTO (que tem clientes reais importados).
 * Só roda com INTEGRACAO=1 e um usuário ativo com permissão financeira:
 *   INTEGRACAO=1 INTEGRACAO_EMAIL=... INTEGRACAO_SENHA=... npx vitest run tests/integracao
 * Requer as migrations 0006, 0007 e 0008 aplicadas.
 *
 * NUNCA apaga tabelas inteiras: cria clientes próprios ("TESTE-INTEGRACAO BAIXA …") com
 * cobranças nas competências 2099-xx e, na limpeza, apaga só essas linhas.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/db/database.types";
import { hojeSP } from "@/domain/datas";

const ATIVO = process.env.INTEGRACAO === "1";
const PREFIXO = "TESTE-INTEGRACAO BAIXA";

let supabase: SupabaseClient<Database>;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => supabase,
  createServiceClient: () => { throw new Error("não usado no teste"); },
}));

describe.skipIf(!ATIVO)("baixa, cancelamento e crédito de indicação (integração)", () => {
  let indicadorId = "";
  let indicadoId = "";
  let contratoIndicador = "";
  let contratoIndicado = "";

  async function idsDosFixtures(): Promise<string[]> {
    const { data } = await supabase.from("clientes").select("id").like("razao_social", `${PREFIXO}%`).throwOnError();
    return (data ?? []).map((c) => c.id);
  }

  /** Apaga só as linhas dos clientes de teste (pagamentos antes, por causa do ON DELETE RESTRICT). */
  async function limparMovimento(ids: string[]) {
    if (ids.length === 0) return;
    const { data: cobs } = await supabase.from("cobrancas").select("id").in("cliente_id", ids).throwOnError();
    const cobIds = (cobs ?? []).map((c) => c.id);
    if (cobIds.length) await supabase.from("pagamentos").delete().in("cobranca_id", cobIds).throwOnError();
    await supabase.from("creditos_movimentos").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("cobrancas").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("lancamentos_extras").delete().in("cliente_id", ids).throwOnError();
  }

  async function limparTudo(ids: string[]) {
    if (ids.length === 0) return;
    await limparMovimento(ids);
    await supabase.from("indicacoes").delete().in("indicado_id", ids).throwOnError();
    await supabase.from("contratos").delete().in("cliente_id", ids).throwOnError();
    await supabase.from("clientes").delete().in("id", ids).throwOnError();
  }

  async function criarCobranca(o: {
    clienteId: string; contratoId: string; competencia: string; vencimento: string; situacao: string;
    itens: { tipo: string; descricao: string; valor: number }[];
  }): Promise<string> {
    const total = o.itens.reduce((s, i) => s + i.valor, 0);
    const { data } = await supabase
      .from("cobrancas")
      .insert({
        cliente_id: o.clienteId, contrato_id: o.contratoId, competencia: o.competencia, origem: "mensal",
        vencimento: o.vencimento, total, situacao: o.situacao, descricao: "teste",
      })
      .select("id")
      .single()
      .throwOnError();
    await supabase.from("cobranca_itens").insert(o.itens.map((i) => ({ ...i, cobranca_id: data!.id }))).throwOnError();
    return data!.id;
  }

  async function saldoCredito(clienteId: string): Promise<number> {
    const { data } = await supabase.from("creditos_movimentos").select("tipo, valor").eq("cliente_id", clienteId).throwOnError();
    return (data ?? []).reduce((s, m) => s + (m.tipo === "liberado" || m.tipo === "estornado" ? m.valor : m.tipo === "usado" ? -m.valor : 0), 0);
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
    const { data: indicador } = await supabase
      .from("clientes").insert({ razao_social: `${PREFIXO} indicador`, situacao: "ativo" }).select("id").single().throwOnError();
    indicadorId = indicador!.id;
    const { data: indicado } = await supabase
      .from("clientes").insert({ razao_social: `${PREFIXO} indicado`, situacao: "ativo", indicado_por: indicadorId })
      .select("id").single().throwOnError();
    indicadoId = indicado!.id;

    const { data: contratos } = await supabase
      .from("contratos")
      .insert([
        { cliente_id: indicadorId, situacao: "fechado", honorario: 22000, dia_vencimento: 20, carteira_id: carteira!.id, tipo_cobranca: "boleto" },
        { cliente_id: indicadoId, situacao: "fechado", honorario: 30000, dia_vencimento: 20, carteira_id: carteira!.id, tipo_cobranca: "boleto" },
      ])
      .select("id, cliente_id")
      .throwOnError();
    contratoIndicador = contratos!.find((c) => c.cliente_id === indicadorId)!.id;
    contratoIndicado = contratos!.find((c) => c.cliente_id === indicadoId)!.id;
  });

  beforeEach(async () => {
    await limparMovimento([indicadorId, indicadoId].filter(Boolean));
    await supabase.from("indicacoes").delete().in("indicado_id", [indicadoId]).throwOnError();
  });

  afterAll(async () => {
    if (!supabase) return;
    const ids = [indicadorId, indicadoId].filter(Boolean);
    await limparTudo(ids.length ? ids : await idsDosFixtures());
    await supabase.auth.signOut();
  });

  async function indicar(): Promise<string> {
    const { data } = await supabase
      .from("indicacoes").insert({ indicador_id: indicadorId, indicado_id: indicadoId }).select("id").single().throwOnError();
    await supabase.from("creditos_movimentos")
      .insert({ cliente_id: indicadorId, indicacao_id: data!.id, tipo: "gerado", valor: 15000 }).throwOnError();
    return data!.id;
  }

  it("baixa integral da 1ª cobrança do indicado → movimento 'liberado' 15000 no indicador (uma vez só)", async () => {
    const { registrarBaixa } = await import("@/db/cobrancas");
    const indicacaoId = await indicar();
    const primeira = await criarCobranca({
      clienteId: indicadoId, contratoId: contratoIndicado, competencia: "2099-02", vencimento: "2099-02-20", situacao: "emitida",
      itens: [{ tipo: "mensalidade", descricao: "Mensalidade", valor: 30000 }],
    });
    const segunda = await criarCobranca({
      clienteId: indicadoId, contratoId: contratoIndicado, competencia: "2099-03", vencimento: "2099-03-20", situacao: "emitida",
      itens: [{ tipo: "mensalidade", descricao: "Mensalidade", valor: 30000 }],
    });

    // pagar antes a segunda não libera (não é a primeira cobrança)
    const r2 = await registrarBaixa(segunda, hojeSP(), 30000);
    expect(r2).toMatchObject({ situacao: "paga", creditoLiberado: 0 });

    const r = await registrarBaixa(primeira, hojeSP(), 30000);
    expect(r).toMatchObject({ situacao: "paga", valorRecebido: 30000, creditoLiberado: 15000, indicadorId });

    const { data: mov } = await supabase.from("creditos_movimentos").select("*").eq("cliente_id", indicadorId).eq("tipo", "liberado").throwOnError();
    expect(mov).toHaveLength(1);
    expect(mov![0]).toMatchObject({ valor: 15000, indicacao_id: indicacaoId, cobranca_id: primeira });
    expect(await saldoCredito(indicadorId)).toBe(15000);

    const { data: cob } = await supabase.from("cobrancas").select("situacao, pago_em").eq("id", primeira).single().throwOnError();
    expect(cob).toMatchObject({ situacao: "paga", pago_em: hojeSP() });
  });

  it("baixa parcial da 1ª cobrança do indicado não libera; completar o valor libera", async () => {
    const { registrarBaixa } = await import("@/db/cobrancas");
    await indicar();
    const id = await criarCobranca({
      clienteId: indicadoId, contratoId: contratoIndicado, competencia: "2099-02", vencimento: "2099-02-20", situacao: "emitida",
      itens: [{ tipo: "mensalidade", descricao: "Mensalidade", valor: 30000 }],
    });
    expect(await registrarBaixa(id, hojeSP(), 10000)).toMatchObject({ situacao: "paga_parcial", creditoLiberado: 0 });
    expect(await registrarBaixa(id, hojeSP(), 20000)).toMatchObject({ situacao: "paga", creditoLiberado: 15000 });
  });

  it("cancelar cobrança do indicador que tinha 'usado' 15000 → 'estornado' e saldo volta a 15000", async () => {
    const { cancelarCobranca } = await import("@/db/cobrancas");
    const indicacaoId = await indicar();
    await supabase.from("creditos_movimentos")
      .insert({ cliente_id: indicadorId, indicacao_id: indicacaoId, tipo: "liberado", valor: 15000 }).throwOnError();
    const id = await criarCobranca({
      clienteId: indicadorId, contratoId: contratoIndicador, competencia: "2099-04", vencimento: "2099-04-20", situacao: "emitida",
      itens: [
        { tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 },
        { tipo: "desconto_indicacao", descricao: "Desconto indicação", valor: -15000 },
      ],
    });
    await supabase.from("creditos_movimentos").insert({ cliente_id: indicadorId, tipo: "usado", valor: 15000, cobranca_id: id }).throwOnError();
    expect(await saldoCredito(indicadorId)).toBe(0);

    const r = await cancelarCobranca(id, "teste de cancelamento");
    expect(r.estornado).toBe(15000);
    const { data: est } = await supabase.from("creditos_movimentos").select("valor").eq("cobranca_id", id).eq("tipo", "estornado").throwOnError();
    expect(est).toEqual([{ valor: 15000 }]);
    expect(await saldoCredito(indicadorId)).toBe(15000);

    const { data: cob } = await supabase.from("cobrancas").select("situacao, motivo_cancelamento").eq("id", id).single().throwOnError();
    expect(cob).toEqual({ situacao: "cancelada", motivo_cancelamento: "teste de cancelamento" });

    // cobrança já cancelada não é cancelada de novo (nem estorna duas vezes)
    await expect(cancelarCobranca(id, "de novo")).rejects.toThrow("Só é possível cancelar cobranças ainda não pagas.");
    expect(await saldoCredito(indicadorId)).toBe(15000);
  });

  it("baixa parcial → v_cobrancas.saldo_aberto = restante e continua atrasada; dispensar saldo encerra", async () => {
    const { cancelarCobranca, dispensarSaldo, registrarBaixa } = await import("@/db/cobrancas");
    const id = await criarCobranca({
      clienteId: indicadorId, contratoId: contratoIndicador, competencia: "2099-05", vencimento: "2020-01-20", situacao: "emitida",
      itens: [{ tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 }],
    });
    expect(await registrarBaixa(id, hojeSP(), 10000)).toMatchObject({ situacao: "paga_parcial", valorRecebido: 10000 });

    const { data: v } = await supabase.from("v_cobrancas").select("saldo_aberto, atrasada, situacao").eq("id", id).single().throwOnError();
    expect(v).toEqual({ saldo_aberto: 12000, atrasada: true, situacao: "paga_parcial" });

    const { listarCobrancasAtrasadas } = await import("@/db/cobrancas");
    expect((await listarCobrancasAtrasadas()).find((c) => c.id === id)).toMatchObject({ saldoAberto: 12000 });

    await expect(cancelarCobranca(id, "não pode")).rejects.toThrow(/Dispensar saldo/);

    await dispensarSaldo(id, "acordo com o cliente");
    const { data: d } = await supabase.from("v_cobrancas").select("saldo_aberto, atrasada, saldo_dispensado").eq("id", id).single().throwOnError();
    expect(d).toEqual({ saldo_aberto: 0, atrasada: false, saldo_dispensado: true });
    await expect(registrarBaixa(id, hojeSP(), 100)).rejects.toThrow("Esta cobrança não aceita baixa.");
  });

  it("baixa com valor maior que o total → paga, diferença como acréscimo", async () => {
    const { registrarBaixa } = await import("@/db/cobrancas");
    const id = await criarCobranca({
      clienteId: indicadorId, contratoId: contratoIndicador, competencia: "2099-06", vencimento: "2020-01-20", situacao: "emitida",
      itens: [{ tipo: "mensalidade", descricao: "Mensalidade", valor: 22000 }],
    });
    expect(await registrarBaixa(id, hojeSP(), 23000)).toMatchObject({ situacao: "paga", valorRecebido: 23000 });
    const { data: v } = await supabase.from("v_cobrancas").select("saldo_aberto, atrasada").eq("id", id).single().throwOnError();
    expect(v).toEqual({ saldo_aberto: 0, atrasada: false });
  });
});
