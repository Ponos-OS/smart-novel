# syntax=docker/dockerfile:1.7

FROM golang:1.26.8-alpine AS base
RUN apk add --no-cache curl \
    && sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d -b /usr/local/bin v3.54.0
# The module is built on its own: go.work also lists ./tools, which the image does not carry.
ENV GOWORK=off
ENV CGO_ENABLED=0
ARG PORT=3000
ENV PORT=${PORT}
WORKDIR /app

# ---- development --------------------------------------------------------
# The sources are mounted over /app/apps, and `task backend:generate` has already run on the host, so nothing is written back into them.
FROM base AS development
ENV APP_ENV=development
COPY apps/backend/go.mod apps/backend/go.sum ./apps/backend/
WORKDIR /app/apps/backend
RUN go mod download && go install github.com/air-verse/air@v1.67.4
EXPOSE $PORT
CMD ["task", "serve"]

# ---- build --------------------------------------------------------------
FROM base AS build
COPY apps/backend/go.mod apps/backend/go.sum ./apps/backend/
RUN --mount=type=cache,target=/go/pkg/mod \
    cd apps/backend && go mod download
COPY apps/backend ./apps/backend
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    task -t apps/backend/Taskfile.yml -d apps/backend codegen
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    task -t apps/backend/Taskfile.yml -d apps/backend build

# ---- migrate ------------------------------------------------------------
# The Job that applies ent/migrate/migrations to DATABASE_URL before a release; the production image carries neither Atlas nor the migrations.
FROM arigaio/atlas:1.3.0-community AS migrate
COPY apps/backend/ent/migrate/migrations /migrations
COPY apps/backend/atlas.hcl /atlas.hcl
ENTRYPOINT ["/atlas"]
CMD ["migrate", "apply", "--config", "file:///atlas.hcl", "--env", "deploy"]

# ---- production ---------------------------------------------------------
FROM alpine:3.23 AS production
RUN apk add --no-cache curl \
    && adduser -D -u 10001 app
ARG PORT=3000
ENV PORT=${PORT}
ENV APP_ENV=production
COPY --from=build /app/apps/backend/bin/server /usr/local/bin/server
USER app
EXPOSE $PORT
CMD ["server"]

# ---- devdata ---------------------------------------------------------------
# The Job that fills the database of the e2e stack; the development stack runs `task devdata` from the mounted sources instead. Not for production.
FROM alpine:3.23 AS devdata
RUN adduser -D -u 10001 app
ENV DATA_PATH=/data
COPY --from=build /app/apps/backend/bin/devdata /usr/local/bin/devdata
COPY apps/backend/data /data
USER app
CMD ["devdata"]
