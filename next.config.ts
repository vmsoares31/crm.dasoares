import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Modelo padrão do contrato lido do disco pela action de geração (o Dockerfile também copia templates/).
  outputFileTracingIncludes: { "/contratos/[id]": ["./templates/**/*"] },
  experimental: {
    authInterrupts: true,
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
