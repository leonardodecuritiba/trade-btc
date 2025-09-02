-- Extend TransactionType enum with SELL and REBOOK
DO $$ BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT','BUY','SELL','REBOOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SELL';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REBOOK';

-- No table shape changes required; transactions table already has qtyBTC and quotePriceBRL

