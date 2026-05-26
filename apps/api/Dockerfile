# Build context = racine du monorepo (cf. docker-compose.yml).
FROM node:20-alpine
WORKDIR /app

# Manifestes d'abord (cache des dépendances).
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install

# Code source.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Contrat partagé puis API (génère le client Prisma + compile TS).
RUN npm run build -w @collab/shared && npm run build -w @collab/api

EXPOSE 4000
# Applique les migrations, crée l'admin (idempotent), puis démarre.
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js"]
