import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integração (banco de desenvolvimento) só com INTEGRACAO=1.
    // Os arquivos de integração usam o mesmo banco: um por vez.
    fileParallelism: process.env.INTEGRACAO !== "1",
    exclude: process.env.INTEGRACAO === "1" ? ["**/node_modules/**", "tests/e2e/**"] : ["**/node_modules/**", "tests/e2e/**", "tests/integracao/**"],
  },
});
