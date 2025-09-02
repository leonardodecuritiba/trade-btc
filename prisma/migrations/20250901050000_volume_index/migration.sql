-- Performance index for daily volume endpoint
CREATE INDEX IF NOT EXISTS "transactions_type_created_idx"
  ON "transactions" ("type", "createdAt" DESC);

