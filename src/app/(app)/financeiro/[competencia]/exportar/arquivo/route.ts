import ExcelJS from "exceljs";

import { ACAO_EXPORTAR, listarExportaveis, listarSaidasCarteiras } from "@/db/exportacao";
import { obterEscritorio } from "@/db/escritorio";
import { gerarCsvCora, type LinhaCora } from "@/domain/cora-csv";
import { formatarData, hojeSP } from "@/domain/datas";
import { formatarDocumento } from "@/domain/documentos";
import { ROTULOS_TIPO_COBRANCA } from "@/domain/rotulos";
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
    const escolhidas = todas.filter((c) => ids.includes(c.id));
    if (escolhidas.length === 0) return json({ erro: "Nenhuma das cobranças selecionadas foi encontrada." }, 404);

    if (formato === "cora") {
      const nomeDe = new Map(escolhidas.map((c) => [c.id, c.clienteNome]));
      // Cobranças de carteira manual ou cartão ficam fora do arquivo do Cora, com aviso.
      const saida = new Map(carteiras.map((c) => [c.id, c.saida]));
      const linhas: LinhaCora[] = escolhidas.map((c) => ({
        cobrancaId: c.id, nomePagador: c.clienteNome, documento: c.documento, valor: c.total, vencimento: c.vencimento,
        nomeCobranca: escritorio.nome_cobranca, descricao: c.descricao, tipo: c.tipo ?? "boleto", email: c.email,
        notificarEm: escritorio.notificar_em, multaPct: escritorio.multa_pct, jurosPct: escritorio.juros_mes_pct,
      }));
      const foraDaCarteira = escolhidas
        .filter((c) => c.tipo !== "cartao" && c.carteiraId && saida.get(c.carteiraId) === "lista_manual")
        .map((c) => ({ cobrancaId: c.id, erro: "Carteira de lista manual (não vai ao Cora)" }));
      const excluidas = new Set(foraDaCarteira.map((e) => e.cobrancaId));
      const { csv, erros: errosCsv } = gerarCsvCora(linhas.filter((l) => !excluidas.has(l.cobrancaId)), hojeSP());
      const erros = [...errosCsv, ...foraDaCarteira].map((e) => ({ cliente: nomeDe.get(e.cobrancaId) ?? e.cobrancaId, erro: e.erro }));
      const comErro = new Set([...errosCsv, ...foraDaCarteira].map((e) => e.cobrancaId));
      const exportadas = escolhidas.filter((c) => !comErro.has(c.id)).map((c) => c.id);
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

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Lista manual");
    ws.columns = [
      { header: "Cliente", key: "cliente", width: 44 }, { header: "CPF/CNPJ", key: "doc", width: 20 },
      { header: "Valor", key: "valor", width: 14, style: { numFmt: '"R$" #,##0.00' } },
      { header: "Vencimento", key: "venc", width: 13 }, { header: "Descrição", key: "desc", width: 44 },
      { header: "Tipo", key: "tipo", width: 14 }, { header: "E-mail", key: "email", width: 32 },
      { header: "Carteira", key: "carteira", width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const c of escolhidas) {
      ws.addRow({
        cliente: c.clienteNome, doc: formatarDocumento(c.documento), valor: c.total / 100, venc: formatarData(c.vencimento),
        desc: c.descricao, tipo: c.tipo ? ROTULOS_TIPO_COBRANCA[c.tipo] : "", email: c.email, carteira: c.carteiraNome,
      });
    }
    const buffer = await wb.xlsx.writeBuffer();
    await registrarAuditoria(ACAO_EXPORTAR, "competencia", null, {
      competencia, saida: "lista_manual", cobranca_ids: escolhidas.map((c) => c.id), com_erro: 0,
    });
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lista-manual-${competencia}.xlsx"`,
        "Cache-Control": "no-store",
        "X-Exportadas": String(escolhidas.length),
        "X-Erros-Total": "0",
        "X-Erros": encodeURIComponent("[]"),
      },
    });
  } catch (e) {
    console.error("[financeiro] exportar:", e);
    return json({ erro: "Não foi possível gerar o arquivo. Tente novamente." }, 500);
  }
}
