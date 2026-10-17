-- Separate merchant-owned Stripe API and webhook-signing credential references.
-- Existing credential_reference remains the server-only API credential reference.
ALTER TABLE kablet_native_payment_accounts
  ADD COLUMN IF NOT EXISTS credential_mode varchar(8) NOT NULL DEFAULT 'test'
    CHECK (credential_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS webhook_signing_secret_reference varchar(300);

COMMENT ON COLUMN kablet_native_payment_accounts.credential_reference IS
  'Server-only encrypted-vault reference for the merchant provider API credential.';
COMMENT ON COLUMN kablet_native_payment_accounts.webhook_signing_secret_reference IS
  'Server-only encrypted-vault reference for the provider webhook signing secret.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_payment_accounts TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_native_payment_accounts TO kablet_control;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_payment_accounts TO kablet_test_bootstrap;
  END IF;
END $$;
