FROM node:20-alpine AS base

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Env vars needed at build time
ARG TMDB_API_KEY
ARG TMDB_READ_ACCESS_TOKEN
ENV TMDB_API_KEY=${TMDB_API_KEY}
ENV TMDB_READ_ACCESS_TOKEN=${TMDB_READ_ACCESS_TOKEN}
ENV MY9_ALLOW_MEMORY_FALLBACK=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MY9_ALLOW_MEMORY_FALLBACK=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
