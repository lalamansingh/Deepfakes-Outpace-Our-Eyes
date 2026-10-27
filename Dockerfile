# syntax=docker/dockerfile:1.7
# Production image: Next.js standalone server, non-root, with health check.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
# Baked into the Content-Security-Policy at build time (bucket media origin, if any).
ARG MEDIA_PUBLIC_ORIGIN=""
ENV NEXT_TELEMETRY_DISABLED=1 \
    MEDIA_PUBLIC_ORIGIN=$MEDIA_PUBLIC_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# ffmpeg strips metadata from uploaded audio/video.
RUN apk add --no-cache ffmpeg && addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
RUN mkdir -p .data/uploads && chown -R app:app .data
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]

# One-off tasks (migrate, seed) run from the full toolchain image:
#   docker compose run --rm tools npm run db:seed
FROM builder AS tools
CMD ["npm", "run", "db:migrate"]
