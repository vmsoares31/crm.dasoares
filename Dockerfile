# Node fixado (22.x >= 22.20); atualize as duas linhas juntas.
FROM node:22.20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# O Next.js grava as variáveis NEXT_PUBLIC_* dentro do código no momento do build, e o
# .dockerignore exclui .env*: informe-as como Build Args (no Easypanel: aba Build).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL     NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY     NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" || (echo "ERRO: Build Arg NEXT_PUBLIC_SUPABASE_URL vazio. Defina-o nos Build Args antes do build." && exit 1)
RUN test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || (echo "ERRO: Build Arg NEXT_PUBLIC_SUPABASE_ANON_KEY vazio. Defina-o nos Build Args antes do build." && exit 1)
RUN npm run build

FROM node:22.20-bookworm-slim AS runtime
# Variáveis de ambiente do contêiner (Easypanel > Ambiente): NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL e TZ.
# NEXT_PUBLIC_* também precisam ser Build Args (são embutidas no build); NEXT_PUBLIC_SITE_URL
# (ex.: https://crm.dasoares.com.br) também é lida em tempo de execução nos redirecionamentos
# do login e de /auth/callback.
# Porta do contêiner: 3000 (escuta em 0.0.0.0); informe 3000 como porta do serviço no Easypanel.
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
