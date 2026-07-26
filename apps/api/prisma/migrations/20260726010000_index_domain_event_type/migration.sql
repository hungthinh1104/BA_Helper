-- Index domain events by (eventType, createdAt) so the account audit trail can be
-- queried efficiently by type and recency.
CREATE INDEX IF NOT EXISTS "DomainEvent_eventType_createdAt_idx"
  ON "DomainEvent" ("eventType", "createdAt");
