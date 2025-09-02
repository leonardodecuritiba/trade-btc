-- Quote snapshots table for 10-minute slots
CREATE TABLE IF NOT EXISTS "quote_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ts" TIMESTAMP(3) NOT NULL UNIQUE,
  "buy" DECIMAL(18,2),
  "sell" DECIMAL(18,2),
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "quote_snapshots_ts_idx" ON "quote_snapshots" ("ts");

