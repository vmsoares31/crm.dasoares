# Node fixado (22.x >= 22.20); atualize as duas linhas juntas.
FROM node:22.20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.20-bookworm-slim AS runtime
# Defina NEXT_PUBLIC_SITE_URL (URL pública, ex.: https://crm.seudominio.com.br) no ambiente do
# contêiner: os redirecionamentos do login e de /auth/callback são montados a partir dela.
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Fontes métricas-compatíveis para o PDF do contrato: Liberation (Arial/Times/Courier) e
# Carlito (Calibri); DejaVu como reserva.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-writer-nogui \
       fonts-dejavu fonts-liberation fonts-crosextra-carlito \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/templates ./templates
EXPOSE 3000
CMD ["node", "server.js"]
