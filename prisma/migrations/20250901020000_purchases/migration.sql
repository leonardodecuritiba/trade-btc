-- Extend enums
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT','BUY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BUY';

DO $$ BEGIN
  CREATE TYPE "Currency" AS ENUM ('BRL','BTC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'BTC';

-- Alter transactions table
ALTER TABLE "transactions" 
  ALTER COLUMN "amountBRL" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "qtyBTC" DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS "quotePriceBRL" DECIMAL(18,2);

-- Create investment_positions table
CREATE TABLE IF NOT EXISTS "investment_positions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "qtyBTC" DECIMAL(18,8) NOT NULL,
  "unitPriceBRL" DECIMAL(18,2) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "investment_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create orders table
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('ENQUEUED','PROCESSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amountBRL" DECIMAL(18,2) NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'ENQUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orders_userId_clientRequestId_key" UNIQUE ("userId","clientRequestId")
);

