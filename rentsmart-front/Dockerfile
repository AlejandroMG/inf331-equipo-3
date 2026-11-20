# Imagen de producción del front (QA-03): compila la SPA y la sirve con Caddy, que además hace de proxy hacia la
# API y saca el certificado HTTPS. La usa docker-compose.prod.yml con el Caddyfile de deploy/.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite fija la URL de la API al compilar. En producción es el mismo origen que el front (PUBLIC_URL).
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "Falta el build arg VITE_API_URL" && exit 1)
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2.10-alpine
COPY --from=build /app/dist /srv
