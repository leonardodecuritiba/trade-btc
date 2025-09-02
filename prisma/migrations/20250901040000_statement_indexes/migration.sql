-- Indexes to support statement queries
CREATE INDEX IF NOT EXISTS "transactions_user_created_id_desc_idx"
  ON "transactions" ("userId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "transactions_user_type_created_id_desc_idx"
  ON "transactions" ("userId", "type", "createdAt" DESC, "id" DESC);

