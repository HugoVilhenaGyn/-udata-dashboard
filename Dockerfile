# =============================================================
# BrokerImobAI — build de produção (Next.js standalone)
# =============================================================

# ---- deps: instala dependências isoladamente (cache melhor) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compila a aplicação ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variáveis só usadas em build-time (nenhum segredo real aqui — os valores
# reais de produção são injetados em runtime via docker-compose/.env).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: imagem final, enxuta ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# next.config.ts com output:"standalone" gera esse pacote mínimo (server.js
# + só os node_modules realmente usados em produção).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
