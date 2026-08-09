# ---------- BASE ----------
FROM node:24.11.1-alpine AS base

# ---------- DEPENDENCIES ----------
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- BUILDER ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# .env is deliberately excluded from the build context so credentials never end up
# in a layer. prisma.config.ts still insists on a DATABASE_URL, and neither
# `prisma generate` nor `next build` connects to the database — a placeholder is
# enough, and it stays in this stage rather than the final image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Prisma client generation (build-time only)
RUN npx prisma generate

# Build Next.js
RUN npm run build

# ---------- RUNNER ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 🔑 REQUIRED: postgres client + shell for entrypoint.sh
RUN apk add --no-cache postgresql-client bash

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime files
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# next.config.ts imports scripts/load-encrypted-env, so the app cannot start without it.
# It also carries the encrypt/decrypt CLI, which is useful for `docker exec`.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# Message catalogues, read at runtime when composing notification emails
COPY --from=builder /app/messages ./messages

# Log directory (LOG_DIR). Created here and owned by the runtime user, because the
# app runs as non-root and could not create it itself. Mount a volume over it to
# keep the files across `docker compose down`.
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs
VOLUME ["/app/logs"]

# Copy entrypoint (Windows-safe)
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Use non-root user
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Same endpoint Kubernetes probes, so `docker ps` reports real readiness.
# Uses busybox wget rather than curl so no extra package is needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
