
# Stage 1: Build
FROM node:20-slim AS builder

# Instalar OpenSSL, um requisito do Prisma
RUN apt-get update && apt-get install -y openssl

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/application/package.json ./packages/application/
COPY packages/domain/package.json ./packages/domain/
COPY packages/shared/package.json ./packages/shared/

# Instalar todas as dependências (incluindo devDependencies)
RUN pnpm install --frozen-lockfile

# Copiar o código-fonte
COPY . .

# Gerar o cliente Prisma
RUN pnpm prisma:generate

# Construir a aplicação API e o worker
RUN pnpm --filter api build && pnpm --filter worker build

# Stage 2: Production
FROM node:20-slim AS production

ENV NODE_ENV=production

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar arquivos de dependência de produção
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/application/package.json ./packages/application/
COPY packages/domain/package.json ./packages/domain/
COPY packages/shared/package.json ./packages/shared/

# Instalar somente dependências de produção
RUN pnpm install --prod --frozen-lockfile

# Copiar os artefatos construídos e o schema do Prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./.prisma

EXPOSE 3000

# Comando para iniciar a aplicação
# O ideal é ter um script que aguarda o banco, roda as migrações e inicia
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node apps/api/dist/server.js"]
