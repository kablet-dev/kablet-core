ALTER TABLE kablet_provider_credentials
  ADD COLUMN IF NOT EXISTS credential_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rotated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

ALTER TABLE kablet_provider_credentials
  ADD CONSTRAINT kablet_provider_credentials_revision_check CHECK (credential_revision > 0);
