-- Provider-neutral payment and reconciliation persistence.
-- This migration deliberately stores only digests/references, never card data
-- or raw browser idempotency keys. Verification authority is deferred to the
-- control/reconciliation slice.

CREATE TABLE IF NOT EXISTS kablet_native_payment_accounts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  provider_key varchar(64) NOT NULL CHECK (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  adapter_version varchar(64) NOT NULL,
  merchant_account_reference varchar(300) NOT NULL,
  credential_reference varchar(300),
  supported_countries varchar(2)[] NOT NULL CHECK (cardinality(supported_countries) > 0),
  supported_currencies varchar(3)[] NOT NULL CHECK (cardinality(supported_currencies) > 0),
  status varchar(20) NOT NULL CHECK (status IN ('pending','onboarding','active','suspended','revoked')),
  can_authorize boolean NOT NULL DEFAULT false,
  can_capture boolean NOT NULL DEFAULT false,
  can_refund boolean NOT NULL DEFAULT false,
  can_receive_webhooks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, provider_key, merchant_account_reference),
  FOREIGN KEY (organization_id, business_id, store_id)
    REFERENCES kablet_native_stores(organization_id, business_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kablet_native_payment_attempts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  checkout_revision integer NOT NULL CHECK (checkout_revision > 0),
  merchant_payment_account_id uuid NOT NULL,
  amount_minor numeric(30,0) NOT NULL CHECK (amount_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  operation_id varchar(300) NOT NULL,
  idempotency_key_hash bytea NOT NULL CHECK (octet_length(idempotency_key_hash) = 32),
  provider_payment_reference varchar(300),
  provider_session_reference varchar(300),
  status varchar(32) NOT NULL CHECK (status IN ('created','session_created','customer_action_required','authorized','captured','failed','cancelled','unknown','reconciled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unknown_at timestamptz,
  last_verified_at timestamptz,
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, id, merchant_payment_account_id),
  UNIQUE (organization_id, business_id, store_id, id, merchant_payment_account_id, amount_minor, currency),
  UNIQUE (organization_id, business_id, store_id, operation_id),
  UNIQUE (organization_id, business_id, store_id, checkout_id, merchant_payment_account_id, idempotency_key_hash),
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_accounts(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS kablet_native_payment_evidence (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  provider_event_reference varchar(300) NOT NULL,
  provider_object_reference varchar(300) NOT NULL,
  provider_payment_reference varchar(300) NOT NULL,
  amount_minor numeric(30,0) NOT NULL CHECK (amount_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_status varchar(20) NOT NULL CHECK (payment_status IN ('authorized','captured','failed','cancelled','refunded','unknown')),
  authentication_method varchar(32) NOT NULL CHECK (authentication_method IN ('signed_webhook','server_retrieval','authorized_reconciliation')),
  verification_status varchar(16) NOT NULL CHECK (verification_status IN ('pending','verified','rejected')),
  provenance varchar(300) NOT NULL,
  observed_at timestamptz NOT NULL,
  authenticated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, id, payment_id, merchant_payment_account_id),
  UNIQUE (organization_id, business_id, store_id, merchant_payment_account_id, provider_event_reference),
  FOREIGN KEY (organization_id, business_id, store_id, payment_id)
    REFERENCES kablet_native_payment_attempts(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, payment_id, merchant_payment_account_id, amount_minor, currency)
    REFERENCES kablet_native_payment_attempts(organization_id, business_id, store_id, id, merchant_payment_account_id, amount_minor, currency)
    ON DELETE RESTRICT,
  CHECK ((verification_status = 'verified' AND authenticated_at IS NOT NULL AND verified_at IS NOT NULL)
    OR verification_status <> 'verified')
);

CREATE TABLE IF NOT EXISTS kablet_native_payment_webhook_inbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  provider_event_id varchar(300) NOT NULL,
  event_type varchar(300) NOT NULL,
  provider_object_reference varchar(300),
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest) = 32),
  signature_status varchar(16) NOT NULL CHECK (signature_status IN ('unverified','verified','rejected')),
  processing_status varchar(16) NOT NULL CHECK (processing_status IN ('received','accepted','processing','processed','retryable','dead_letter','ignored')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code varchar(100),
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (organization_id, business_id, store_id, merchant_payment_account_id, provider_event_id),
  FOREIGN KEY (organization_id, business_id, store_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_accounts(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS kablet_native_payment_reconciliations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  reconciliation_key_hash bytea NOT NULL CHECK (octet_length(reconciliation_key_hash) = 32),
  reason varchar(32) NOT NULL CHECK (reason IN ('unknown_payment','conflicting_evidence','late_payment','webhook_gap')),
  status varchar(24) NOT NULL CHECK (status IN ('pending','in_progress','still_unknown','resolved_paid','resolved_not_paid','escalated')),
  resolution_evidence_id uuid,
  authorized_resolution_reference varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (organization_id, business_id, store_id, payment_id, reconciliation_key_hash),
  CHECK ((status IN ('resolved_paid','resolved_not_paid')
      AND resolution_evidence_id IS NOT NULL
      AND authorized_resolution_reference IS NOT NULL
      AND resolved_at IS NOT NULL)
    OR status NOT IN ('resolved_paid','resolved_not_paid')),
  FOREIGN KEY (organization_id, business_id, store_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_attempts(organization_id, business_id, store_id, id, merchant_payment_account_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, resolution_evidence_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_evidence(organization_id, business_id, store_id, id, payment_id, merchant_payment_account_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS kablet_native_payment_webhook_pending_idx
  ON kablet_native_payment_webhook_inbox(organization_id, business_id, store_id, processing_status, next_attempt_at);
CREATE INDEX IF NOT EXISTS kablet_native_payment_reconciliation_active_idx
  ON kablet_native_payment_reconciliations(organization_id, business_id, store_id, status, updated_at);
CREATE INDEX IF NOT EXISTS kablet_native_payment_attempt_checkout_idx
  ON kablet_native_payment_attempts(organization_id, business_id, store_id, checkout_id, created_at);

ALTER TABLE kablet_native_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_webhook_inbox FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_payment_reconciliations FORCE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kablet_native_payment_accounts','kablet_native_payment_attempts','kablet_native_payment_evidence','kablet_native_payment_webhook_inbox','kablet_native_payment_reconciliations'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business())', t || '_tenant_isolation', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION kablet_native_payment_attempt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organization_id <> NEW.organization_id OR OLD.business_id <> NEW.business_id OR OLD.store_id <> NEW.store_id
    OR OLD.checkout_id <> NEW.checkout_id OR OLD.checkout_revision <> NEW.checkout_revision
    OR OLD.merchant_payment_account_id <> NEW.merchant_payment_account_id OR OLD.amount_minor <> NEW.amount_minor
    OR OLD.currency <> NEW.currency OR OLD.operation_id <> NEW.operation_id OR OLD.idempotency_key_hash <> NEW.idempotency_key_hash THEN
    RAISE EXCEPTION 'payment attempt identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kablet_native_payment_attempt_immutable_trigger
  BEFORE UPDATE ON kablet_native_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION kablet_native_payment_attempt_immutable();

CREATE OR REPLACE FUNCTION kablet_native_payment_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'payment evidence is immutable'; END $$;
CREATE TRIGGER kablet_native_payment_evidence_immutable_trigger
  BEFORE UPDATE OR DELETE ON kablet_native_payment_evidence
  FOR EACH ROW EXECUTE FUNCTION kablet_native_payment_evidence_immutable();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_payment_accounts, kablet_native_payment_attempts, kablet_native_payment_evidence, kablet_native_payment_webhook_inbox, kablet_native_payment_reconciliations TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    -- Webhook lease bookkeeping is safe to expose to the existing control
    -- plane. Evidence, payment status, and reconciliation resolution remain
    -- unavailable until D.2D establishes authenticated authority.
    GRANT SELECT, INSERT, UPDATE ON kablet_native_payment_webhook_inbox TO kablet_control;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_payment_accounts, kablet_native_payment_attempts, kablet_native_payment_evidence, kablet_native_payment_webhook_inbox, kablet_native_payment_reconciliations TO kablet_test_bootstrap;
  END IF;
END $$;
