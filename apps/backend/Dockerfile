# syntax=docker/dockerfile:1.7
# BuildKit is required for `--mount=type=cache` support below.

FROM node:24.13-alpine AS base
RUN apk add --no-cache curl \
    && sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin v3.54.0
RUN npm install -g npm@11.6.2
WORKDIR /app
ARG PORT
ENV PORT=${PORT}
EXPOSE $PORT
COPY package*.json Taskfile.yml tsconfig*.json eslint.config.mjs ./

# ---- deps ---------------------------------------------------------------
# Full install (incl. devDeps). Cached across builds via BuildKit's `--mount=type=cache` on the npm cache directory.
FROM base AS deps
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- development --------------------------------------------------------
# Used and rely on the image's node_modules.
FROM base AS development
ENV APP_ENV=development
ENV CHOKIDAR_USEPOLLING=1
ENV WATCHPACK_POLLING=true
COPY --from=deps /app/node_modules ./node_modules
CMD ["/bin/sh", "-c", "task backend:prisma:generate backend:serve"]

# ---- production ---------------------------------------------------------
# Interim: the NestJS backend runs from source with swc until the Go backend replaces it, so this image keeps the full node_modules.
FROM base AS production
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG BEATRICE_VERSION
ENV BEATRICE_VERSION=${BEATRICE_VERSION}
ARG FITHARA_VERSION
ENV FITHARA_VERSION=${FITHARA_VERSION}
ENV APP_ENV=production
ENV SWC_NODE_PROJECT=tsconfig.app.json
COPY --from=deps /app/node_modules ./node_modules
COPY apps/backend ./apps/backend
COPY libs ./libs
RUN task -t apps/backend/Taskfile.yml -d apps/backend generate
COPY apps/backend/data /data
WORKDIR /app/apps/backend
CMD ["node", "-r", "@swc-node/register", "src/main.ts"]
