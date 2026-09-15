# syntax=docker/dockerfile:1.7
# BuildKit is required for `--mount=type=cache` support below.

FROM node:24.13-alpine AS base
RUN apk add --no-cache curl
RUN npm install -g npm@11.6.2
ENV HUSKY=0
WORKDIR /app
ARG PORT
ENV PORT=${PORT}
EXPOSE $PORT
COPY package*.json nx.json tsconfig*.json eslint.config.mjs ./

# ---- deps ---------------------------------------------------------------
# Full install (incl. devDeps). Cached across builds via BuildKit's `--mount=type=cache` on the npm cache directory.
FROM base AS deps
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- deps-prod ----------------------------------------------------------
# Prod-only install for the runtime image. Same caching strategy.
FROM base AS deps-prod
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# ---- development --------------------------------------------------------
# Used and rely on the image's node_modules.
FROM base AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1
ENV WATCHPACK_POLLING=true
ENV NX_DAEMON=true
COPY --from=deps /app/node_modules ./node_modules
CMD ["/bin/sh", "-c", "npx nx prisma:generate backend && npx nx serve backend"]

# ---- builder ------------------------------------------------------------
# Builds the production bundle. Reuses node_modules from `deps` so we don't re-run `npm ci` here.
FROM base AS builder
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG BEATRICE_VERSION
ENV BEATRICE_VERSION=${BEATRICE_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY nx.json ./
COPY apps/backend ./apps/backend
RUN npx nx prisma:generate backend
RUN npx nx build backend --prod

# ---- production ---------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist/apps/backend ./dist
COPY apps/backend/data /data
CMD ["node", "dist/main.js"]
