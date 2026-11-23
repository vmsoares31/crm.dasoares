import ExcelJS from "exceljs";

import { ACAO_EXPORTAR, listarExportaveis, listarSaidasCarteiras, type CobrancaExportavel } from "@/db/exportacao";
import { obterEscritorio } from "@/db/escritorio";
import { CORA_CABECALHO, camposCora, gerarCsvCora, separarExportaveis, separarPorSaida, type LinhaCora } from "@/domain/cora-csv";
import { hojeSP } from "@/domain/datas";
import { registrarAuditoria } from "@/lib/auditoria";
import { SemPermissaoError, exigirPermissao } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ERROS_NO_CABECALHO = 15;

function json(corpo: object, status: number): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

/** POST com `formato` (cora | excel) e `ids` (uma ou mais cobranças da competência). */
export async function POST(request: Request, { params }: { params: Promise<{ competencia: string }> }) {
  try {
    await exigirPermissao("financeiro.operar");
  } catch (e) {
    if (e instanceof SemPermissaoError) return json({ erro: "Você não tem permissão para operar o financeiro." }, 403);
    return json({ erro: "Não foi possível verificar suas permissões." }, 500);
  }

  const { competencia } = await params;
  if (!COMPETENCIA.test(competencia)) return json({ erro: "Competência inválida." }, 400);
  const form = await request.formData();
  const formato = form.get("formato");
  const ids = [...new Set(form.getAll("ids").filter((v): v is string => typeof v === "string" && UUID.test(v)))];
  if (formato !== "cora" && formato !== "excel") return json({ erro: "Formato inválido." }, 400);
  if (ids.length === 0) return json({ erro: "Selecione ao menos uma cobrança." }, 400);

  try {
    const [todas, escritorio, carteiras] = await Promise.all([
      listarExportaveis(competencia), obterEscritorio(), listarSaidasCarteiras(),
    ]);
    const selecionadas = todas.filter((c) => ids.includes(c.id));
    if (selecionadas.length === 0) return json({ erro: "Nenhuma das cobranças selecionadas foi encontrada." }, 404);
    // Só cobranças ainda previstas saem em arquivo (evita boleto em duplicidade).
    const { previstas, ignoradas } = separarExportaveis(selecionadas);
    const erros: { cliente: string; erro: string }[] = ignoradas.map((c) => ({ cliente: c.clienteNome, erro: "Não está mais prevista (já emitida, paga ou cancelada)" }));
    if (previstas.length === 0) return json({ erro: "Nenhuma das cobranças selecionadas está prevista.", erros }, 422);

    const dados = (c: CobrancaExportavel): LinhaCora => ({
      cobrancaId: c.id, nomePagador: c.clienteNome, documento: c.documento, valor: c.total, vencimento: c.vencimento,
      nomeCobranca: escritorio.nome_cobranca, descricao: c.descricao, tipo: c.tipo ?? "boleto", email: c.email,
      notificarEm: escritorio.notificar_em, multaPct: escritorio.multa_pct, jurosPct: escritorio.juros_mes_pct,
    });

    if (formato === "cora") {
      const { cora, manual } = separarPorSaida(
        previstas.map((c) => ({ ...c, carteiraId: c.carteiraId })), carteiras,
      );
      for (const c of manual) erros.push({ cliente: c.clienteNome, erro: "Vai para a lista manual (cartão, carteira manual ou sem carteira)" });
      const nomeDe = new Map(cora.map((c) => [c.id, c.clienteNome]));
      const { csv, erros: errosCsv } = gerarCsvCora(cora.map(dados), hojeSP());
      for (const e of errosCsv) erros.push({ cliente: nomeDe.get(e.cobrancaId) ?? e.cobrancaId, erro: e.erro });
      const comErro = new Set(errosCsv.map((e) => e.cobrancaId));
      const exportadas = cora.filter((c) => !comErro.has(c.id)).map((c) => c.id);
      if (exportadas.length === 0) return json({ erro: "Nenhuma cobrança pôde entrar no arquivo.", erros }, 422);

      await registrarAuditoria(ACAO_EXPORTAR, "competencia", null, { competencia, saida: "csv_cora", cobranca_ids: exportadas, com_erro: erros.length });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="cora-${competencia}.csv"`,
          "Cache-Control": "no-store",
          "X-Exportadas": String(exportadas.length),
          "X-Erros-Total": String(erros.length),
          "X-Erros": encodeURIComponent(JSON.stringify(erros.slice(0, MAX_ERROS_NO_CABECALHO))),
        },
      });
    }

    // Lista manual: mesmas colunas do CSV do Cora + carteira.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Lista manual");
    const larguras = [44, 18, 12, 12, 22, 44, 12, 32, 12, 8, 12, 10, 18, 20];
    ws.columns = [...CORA_CABECALHO, "carteira"].map((h, i) => ({ header: h, key: h, width: larguras[i] }));
    ws.getRow(1).font = { bold: true };
    for (const c of previstas) {
      const campos = camposCora(dados(c));
      ws.addRow([...campos.slice(0, 2), c.total / 100, ...campos.slice(3), c.carteiraNome]);
    }
    ws.getColumn(3).numFmt = "#,##0.00";
    ws.getColumn(2).numFmt = "@";
    const buffer = await wb.xlsx.writeBuffer();
    await registrarAuditoria(ACAO_EXPORTAR, "competencia", null, {
      competencia, saida: "lista_manual", cobranca_ids: previstas.map((c) => c.id), com_erro: erros.length,
    });
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lista-manual-${competencia}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Exportadas": String(previstas.length),
        "X-Erros-Total": String(erros.length),
        "X-Erros": encodeURIComponent(JSON.stringify(erros.slice(0, MAX_ERROS_NO_CABECALHO))),
      },
    });
  } catch (e) {
    console.error("[financeiro] exportar:", e);
    return json({ erro: "Não foi possível gerar o arquivo. Tente novamente." }, 500);
  }
}
