-- Transactions & Ledger for deposits
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT');
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT','DEBIT');
CREATE TYPE "Currency" AS ENUM ('BRL');

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "TransactionType" NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "amountBRL" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transactions_userId_clientRequestId_key" UNIQUE ("userId", "clientRequestId")
);

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "transactionId" UUID NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "currency" "Currency" NOT NULL,
  "amount" DECIMAL(18,8) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
