-- Deduplicate Meta webhook retries and allow recovery from interrupted sends.
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  message_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  outbound_message_id TEXT,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_expires_at
  ON whatsapp_webhook_events (expires_at);
