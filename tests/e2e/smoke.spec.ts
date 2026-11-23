/* Teste de fumaça: login -> cliente -> competência de teste -> CSV -> emitida -> baixa -> painel.
 *
 * Só roda com E2E_EMAIL (e E2E_SENHA). Variáveis: BASE_URL, E2E_EMAIL, E2E_SENHA, E2E_COMPETENCIA.
 *
 * ATENÇÃO: "Abrir mês" GERA cobranças para todos os contratos ativos da competência e a baixa
 * altera uma delas. Rode apenas contra o banco de DESENVOLVIMENTO (ou um ambiente descartável),
 * com pelo menos um cliente e um contrato ativo, e use uma competência de teste (E2E_COMPETENCIA,
 * padrão 2099-12) que não exista em dados reais. Nunca aponte para a produção. */
import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const senha = process.env.E2E_SENHA ?? "";
const competencia = process.env.E2E_COMPETENCIA ?? "2099-12";

test.skip(!email, "E2E_EMAIL não definido: teste de fumaça ignorado.");

test("fluxo principal do financeiro", async ({ page }) => {
  // Login
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/inicio");

  // Abrir um cliente
  await page.goto("/clientes");
  await page.locator('a[href^="/clientes/"]:not([href*="novo"]):not([href*="edicao"])').first().click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}/);

  // Abrir a competência de teste
  await page.goto(`/financeiro/${competencia}`);
  const abrir = page.getByRole("button", { name: "Abrir mês" });
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByRole("link", { name: "Exportar" })).toBeVisible({ timeout: 30_000 });

  // Exportar CSV
  await page.getByRole("link", { name: "Exportar" }).click();
  await page.waitForURL(`**/financeiro/${competencia}/exportar`);
  const todas = page.getByLabel("Selecionar todas");
  if (!(await todas.isChecked())) await todas.check();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Baixar CSV Cora/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);

  // Marcar como emitidas
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Marcar todas do último arquivo" }).click();

  // Dar baixa em uma cobrança (valor já vem preenchido com o saldo)
  await page.goto(`/financeiro/${competencia}`);
  await page.locator('a[href^="/financeiro/cobrancas/"]').first().click();
  await page.getByRole("button", { name: "Dar baixa" }).click();
  await page.getByRole("button", { name: "Registrar baixa" }).click();

  // Painel mostra recebido
  await page.goto(`/financeiro?competencia=${competencia}`);
  const cartao = page.locator("section[aria-label='Totais do mês']").getByText("Recebido", { exact: true }).locator("xpath=..");
  await expect(cartao).not.toContainText(/R\$\s*0,00/);
});
