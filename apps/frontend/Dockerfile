FROM node:24.13-alpine AS base
RUN apk add --no-cache curl
RUN npm install -g npm@11.6.2
ENV HUSKY=0
WORKDIR /app
ARG FRONTEND_PORT=4200
ENV FRONTEND_PORT=$FRONTEND_PORT
ARG VITE_SERVICE_URL
ENV VITE_SERVICE_URL=$VITE_SERVICE_URL
ARG VITE_OIDC_CLIENT_ID
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_AUTHORITY
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ARG VITE_OIDC_REDIRECT_URI
ENV VITE_OIDC_REDIRECT_URI=$VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_SCOPE
ENV VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE
ARG VITE_OTLP_ENDPOINT
ENV VITE_OTLP_ENDPOINT=$VITE_OTLP_ENDPOINT
ARG VITE_SERVICE_NAME
ENV VITE_SERVICE_NAME=$VITE_SERVICE_NAME
ARG VITE_SERVICE_VERSION
ENV VITE_SERVICE_VERSION=$VITE_SERVICE_VERSION
EXPOSE $FRONTEND_PORT
COPY package*.json nx.json tsconfig*.json eslint.config.mjs ./

FROM base AS development
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1
ENV WATCHPACK_POLLING=true
ENV NX_DAEMON=true
RUN npm ci
CMD ["npx", "nx", "serve", "frontend", "--host=0.0.0.0"]

FROM base AS builder
COPY tsconfig.base.json ./
COPY nx.json ./
RUN npm ci
COPY apps/frontend ./apps/frontend
RUN npx nx build frontend --prod

FROM nginx:alpine AS production
COPY --from=builder /app/dist/apps/frontend /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
