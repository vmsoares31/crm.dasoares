import { defineConfig } from "@playwright/test";

// Teste de fumaça contra um ambiente já em execução (desenvolvimento ou homologação).
// Variáveis: BASE_URL (padrão http://localhost:3000), E2E_EMAIL, E2E_SENHA, E2E_COMPETENCIA.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
});
