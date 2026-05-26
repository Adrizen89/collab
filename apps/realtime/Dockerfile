# Build context = racine du monorepo (cf. docker-compose.yml).
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/realtime/package.json apps/realtime/
RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/realtime apps/realtime

RUN npm run build -w @collab/shared && npm run build -w @collab/realtime

EXPOSE 4001
CMD ["node", "apps/realtime/dist/index.js"]
