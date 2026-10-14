-- Recovery guards for resumable catalog work and crashed webhook claims.
ALTER TABLE kablet_catalog_syncs
  ADD CONSTRAINT kablet_catalog_syncs_nonnegative_counts CHECK (records_applied <= records_seen);

CREATE UNIQUE INDEX IF NOT EXISTS kablet_catalog_syncs_one_running
  ON kablet_catalog_syncs (connection_id)
  WHERE status = 'running';

ALTER TABLE kablet_provider_webhook_inbox
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

ALTER TABLE kablet_catalog_syncs
  ADD COLUMN IF NOT EXISTS claimed_by varchar(200),
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    REVOKE INSERT ON kablet_provider_webhook_inbox FROM kablet_dev;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS kablet_provider_webhook_recovery_idx
  ON kablet_provider_webhook_inbox (status, claim_expires_at)
  WHERE status = 'processing';
