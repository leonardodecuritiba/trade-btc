# Plataforma BTC – Monorepo (API, Worker e Use Cases)

Este projeto implementa uma plataforma de negociação BTC em Node.js/TypeScript com arquitetura em camadas (Clean Architecture + DDD), persistência em PostgreSQL (via Prisma), cache/fila com Redis/BullMQ e testes com Jest. O repositório é um monorepo com serviços de API (Express) e Worker (BullMQ/jobs).

## Arquitetura e Stack
- Linguagem: Node.js 20 + TypeScript
- Web/API: Express
- Banco de dados: PostgreSQL + Prisma ORM
- Cache / Fila: Redis + BullMQ
- Logs: Pino (JSON)
- Validação: Zod
- Testes: Jest + Supertest
- Observabilidade: logs estruturados; endpoints com rate‑limit

Camadas (Clean Architecture):
- `packages/application`: casos de uso (regras de aplicação)
- `packages/domain`: entidades/VOs (quando aplicável)
- `packages/shared`: utilitários (erros, precisão numérica, etc.)
- `apps/api`: camada de entrega HTTP (Express), controllers, middlewares, adapters Prisma/Redis
- `apps/worker`: workers (fila/cron) para processamento assíncrono e jobs (ex.: histórico de cotações)
- `prisma`: schema, migrações e artefatos do Prisma

Estrutura (resumo):
- `apps/api/src/http`: rotas, controllers e middlewares
- `apps/api/src/adapters`: adapters (Prisma, Redis, provedores)
- `apps/worker/src`: inicialização do worker, fila FIFO por usuário, jobs de histórico
- `packages/application/src/use-cases`: casos de uso (ex.: autenticação, depósitos, compras/vendas, extrato, posições, volume diário, histórico de cotações)
- `prisma/migrations`: migrações SQL gerenciadas pelo Prisma

## Premissas Gerais
- Precisão e arredondamento:
  - BRL: banker’s rounding (2 casas decimais)
  - BTC: truncamento em até 8 casas decimais
- Idempotência em escritas: `clientRequestId` (unicidade por usuário/endpoint)
- Fila FIFO por usuário: `orders:{userId}` (BullMQ), com processamento serial
- Cotação:
  - Provedor: MercadoBitcoin (stub disponível para testes)
  - Cache Redis com TTL=10s
  - `buy` = preço de compra, `sell` = preço de venda
- Segurança:
  - JWT (~15min), bcrypt cost ≥ 12
  - Rate‑limit em rotas sensíveis/públicas

## Requisitos (Linux)
- Node.js 20.x
- pnpm 8+
- Docker e Docker Compose (opcional, recomendado para infra local)

## Configuração de Ambiente
1) Clone o repositório e instale dependências:
```
pnpm install
```

2) Variáveis de ambiente:
- Arquivo `.env.test` já contém defaults para execução de testes.
- Para desenvolvimento, use `.env` (você pode copiar do `.env.test` e ajustar):
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/btc?schema=public`
  - `REDIS_URL=redis://localhost:6379`
  - `JWT_SECRET=change-me`
  - `BCRYPT_COST=12`
  - `QUOTE_PROVIDER=stub` (ou `mercadobitcoin`)
  - `QUOTE_CACHE_TTL_SECONDS=10`
  - Parâmetros de rate‑limit (opcionais): `RATE_LIMIT_WINDOW_SEC`, `RATE_LIMIT_MAX_*`
  - Worker jobs de histórico (opcional): `HISTORY_JOBS=1`

## Subindo a Infra (Docker)
O repositório inclui `docker-compose.yml` e `Dockerfile` para subir Postgres, Redis, API e Worker.

- Subir toda a stack (API, Worker, DB e Redis):
```
docker-compose up -d --build
```
A API ficará disponível em `http://localhost:3000`.

- Apenas a infra de dados (DB/Redis) para rodar localmente com TS:
```
docker-compose up -d db redis
```

## Banco de Dados (Prisma)
- Gerar cliente:
```
pnpm prisma:generate
```
- Aplicar migrações (dev):
```
pnpm prisma:migrate
```
- Em execução via Dockerfile, a imagem chama `prisma migrate deploy` no startup da API.

## Executando a API e Worker (Dev – TS Node)
- API (com reload TS):
```
pnpm start:dev
```
A API expõe Swagger UI em `http://localhost:3000/docs` e os YAMLs em `/openapi`.

- Worker (fila e jobs):
```
# Somente o worker (pode rodar em paralelo com a API)
pnpm --filter worker start:dev
```
- Habilitar jobs de histórico (coletor/limpeza):
```
HISTORY_JOBS=1 QUOTE_PROVIDER=stub REDIS_URL=redis://localhost:6379 pnpm --filter worker start:dev
```
Mais detalhes em `apps/worker/README.md`.

## Testes
- Pré‑requisito: Postgres e Redis acessíveis (por exemplo, via `docker-compose up -d db redis`).
- Rodar a suíte completa (Jest):
```
pnpm test
```
Os testes usam `.env.test` e populam o banco temporariamente (limpeza automática em `beforeEach`).

## Endpoints (resumo)
- Autenticação: `POST /auth/register`, `POST /auth/login`
- Depósitos: `POST /deposits`
- Saldo: `GET /balance`
- Cotações (snapshot atual): `GET /quotes/current`
- Posições abertas: `GET /positions`
- Ordens:
  - Compra: `POST /orders/buy` (assíncrono, FIFO por usuário)
  - Venda: `POST /orders/sell` (assíncrono, FIFO por usuário; REBOOK na parcial)
- Extrato (statement): `GET /statement?from&to&types[]&cursor&limit`
- Volume diário: `GET /metrics/daily-volume`
- Histórico de cotações (24h/10m): `GET /quotes/history`

Todas as rotas sensíveis estão protegidas por JWT e sujeitas a rate‑limit (por usuário). Em desenvolvimento, o provedor de cotações pode ser setado como `stub` via env.

## Observações
- Ajuste de TZs: o projeto alinha janelas sensíveis (ex.: posições/statement/volume/histórico) à TZ `America/Sao_Paulo`, conforme especificado nas docs.
- Precisão: aplicações financeiras exigem arredondamento consistente. Os utilitários em `packages/shared` padronizam banker’s (BRL) e truncamento (BTC).

## Troubleshooting
- Erro de conexão com DB/Redis: garanta que `docker-compose up -d db redis` está rodando e que `DATABASE_URL`/`REDIS_URL` estão corretos.
- Migrações “drop index” inesperadas: o schema Prisma declara índices com `map` para casar com migrações SQL. Certifique-se de rodar `pnpm prisma:generate` e `pnpm prisma:migrate` após alterações.
- Cotações em testes: `QUOTE_PROVIDER=stub` e variáveis `QUOTE_STUB_BUY`/`QUOTE_STUB_SELL` podem ser usadas para parametrizar valores.
