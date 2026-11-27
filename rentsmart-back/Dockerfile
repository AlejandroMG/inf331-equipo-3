# Imagen de producción de la API (QA-03). La usa docker-compose.prod.yml.
# Node 24.9+ es obligatorio (ver AGENTS.md). Prisma necesita openssl.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
# Se instalan también las dependencias de desarrollo: el CLI de Prisma (migraciones) y tsx (seed) son devDependencies.
RUN npm ci

COPY . .
# prisma.config.ts exige DATABASE_URL aunque generate no se conecta: basta una URL de relleno.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

EXPOSE 3000
# Aplica las migraciones pendientes antes de arrancar; si fallan, el contenedor no arranca.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
