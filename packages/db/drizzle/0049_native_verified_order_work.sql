-- Durable handoff from authenticated captured-payment evidence to the
-- provider-neutral verified-order worker. The existing payment webhook inbox
-- remains the deduplication and recovery boundary.

ALTER TABLE kablet_native_payment_webhook_inbox
  ADD COLUMN IF NOT EXISTS order_status varchar(16) NOT NULL DEFAULT 'not_required'
    CHECK (order_status IN ('not_required','pending','processing','processed','retryable','recovery','dead_letter')),
  ADD COLUMN IF NOT EXISTS order_attempt_count integer NOT NULL DEFAULT 0 CHECK (order_attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS order_worker_id varchar(200),
  ADD COLUMN IF NOT EXISTS order_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS order_last_error_code varchar(100),
  ADD COLUMN IF NOT EXISTS order_processed_at timestamptz;

-- The restricted control worker is the only cross-tenant claimant. It may
-- inspect only the inbox/evidence rows needed to claim captured work; every
-- subsequent write restores the row's tenant context before applying RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kablet_native_payment_webhook_inbox' AND policyname='kablet_native_order_worker_read') THEN
    CREATE POLICY kablet_native_order_worker_read ON kablet_native_payment_webhook_inbox
      FOR SELECT USING (session_user = 'kablet_control');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kablet_native_payment_evidence' AND policyname='kablet_native_order_worker_read') THEN
    CREATE POLICY kablet_native_order_worker_read ON kablet_native_payment_evidence
      FOR SELECT USING (session_user = 'kablet_control');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kablet_native_payment_webhook_inbox' AND policyname='kablet_native_order_worker_claim') THEN
    CREATE POLICY kablet_native_order_worker_claim ON kablet_native_payment_webhook_inbox
      FOR UPDATE USING (session_user = 'kablet_control') WITH CHECK (session_user = 'kablet_control');
  END IF;
END $$;

-- Evidence and the work handoff are written by the same ingestion function.
-- This backfill makes already-accepted captured evidence recoverable when the
-- migration is applied to a database that predates this worker state.
UPDATE kablet_native_payment_webhook_inbox i
SET order_status = 'pending'
WHERE i.order_status = 'not_required'
  AND EXISTS (
    SELECT 1 FROM kablet_native_payment_evidence e
    WHERE e.id = i.id AND e.verification_status = 'verified' AND e.payment_status = 'captured'
  );

CREATE INDEX IF NOT EXISTS kablet_native_payment_order_work_idx
  ON kablet_native_payment_webhook_inbox(order_status, order_next_attempt_at, order_lease_expires_at, created_at, id);

CREATE OR REPLACE FUNCTION kablet_ingest_verified_native_payment_evidence(
  p_evidence_id uuid,
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_merchant_payment_account_id uuid,
  p_provider_event_id varchar,
  p_event_type varchar,
  p_provider_object_reference varchar,
  p_payload_digest bytea,
  p_payment_id uuid,
  p_provider_payment_reference varchar,
  p_amount_minor numeric,
  p_currency varchar,
  p_payment_status varchar,
  p_observed_at timestamptz
) RETURNS TABLE(inserted boolean, evidence_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  inbox_id uuid;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'authenticated payment ingestion authority is required';
  END IF;
  IF p_payload_digest IS NULL OR octet_length(p_payload_digest) <> 32
     OR p_provider_event_id IS NULL OR length(trim(p_provider_event_id)) = 0
     OR p_provider_object_reference IS NULL OR length(trim(p_provider_object_reference)) = 0
     OR p_provider_payment_reference IS NULL OR length(trim(p_provider_payment_reference)) = 0
     OR p_amount_minor IS NULL OR p_amount_minor < 0
     OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
     OR p_payment_status NOT IN ('authorized', 'captured', 'failed', 'cancelled', 'refunded', 'unknown') THEN
    RAISE EXCEPTION 'authenticated payment evidence is invalid';
  END IF;

  PERFORM set_config('kablet.organization_id', p_organization_id::text, true);
  PERFORM set_config('kablet.business_id', p_business_id::text, true);

  INSERT INTO kablet_native_payment_webhook_inbox (
    id, organization_id, business_id, store_id,
    merchant_payment_account_id, provider_event_id, event_type,
    provider_object_reference, payload_digest, signature_status,
    processing_status, attempt_count, occurred_at, order_status
  ) VALUES (
    p_evidence_id, p_organization_id, p_business_id, p_store_id,
    p_merchant_payment_account_id, p_provider_event_id, p_event_type,
    p_provider_object_reference, p_payload_digest, 'verified',
    'accepted', 1, p_observed_at,
    CASE WHEN p_payment_status = 'captured' THEN 'pending' ELSE 'not_required' END
  ) ON CONFLICT (organization_id, business_id, store_id, merchant_payment_account_id, provider_event_id)
    DO NOTHING
  RETURNING id INTO inbox_id;

  IF inbox_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO kablet_native_payment_evidence (
    id, organization_id, business_id, store_id, payment_id,
    merchant_payment_account_id, provider_event_reference,
    provider_object_reference, provider_payment_reference,
    amount_minor, currency, payment_status, authentication_method,
    verification_status, provenance, observed_at, authenticated_at, verified_at
  ) VALUES (
    p_evidence_id, p_organization_id, p_business_id, p_store_id, p_payment_id,
    p_merchant_payment_account_id, p_provider_event_id,
    p_provider_object_reference, p_provider_payment_reference,
    p_amount_minor, p_currency, p_payment_status, 'signed_webhook',
    'verified', 'stripe.signed_webhook', p_observed_at, clock_timestamp(), clock_timestamp()
  );

  RETURN QUERY SELECT true, p_evidence_id;
END;
$$;

REVOKE ALL ON FUNCTION kablet_ingest_verified_native_payment_evidence(uuid, uuid, uuid, uuid, uuid, varchar, varchar, varchar, bytea, uuid, varchar, numeric, varchar, varchar, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION kablet_claim_native_verified_order_work(
  p_worker_id varchar,
  p_lease_seconds integer DEFAULT 60,
  p_max_attempts integer DEFAULT 5
) RETURNS TABLE(
  evidence_id uuid,
  organization_id uuid,
  business_id uuid,
  store_id uuid,
  payment_id uuid,
  attempt_count integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  work record;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'verified order worker authority is required';
  END IF;
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 OR length(p_worker_id) > 200
     OR p_lease_seconds < 5 OR p_lease_seconds > 300
     OR p_max_attempts < 1 OR p_max_attempts > 20 THEN
    RAISE EXCEPTION 'verified order worker parameters are invalid';
  END IF;

  SELECT i.id, i.organization_id, i.business_id, i.store_id, e.payment_id,
         i.order_attempt_count
    INTO work
    FROM kablet_native_payment_webhook_inbox i
    JOIN kablet_native_payment_evidence e
      ON e.id = i.id
     AND e.organization_id = i.organization_id
     AND e.business_id = i.business_id
     AND e.store_id = i.store_id
     AND e.merchant_payment_account_id = i.merchant_payment_account_id
    WHERE e.verification_status = 'verified'
      AND e.payment_status = 'captured'
      AND i.order_attempt_count < p_max_attempts
      AND (
        (i.order_status IN ('pending','retryable') AND (i.order_next_attempt_at IS NULL OR i.order_next_attempt_at <= clock_timestamp()))
        OR (i.order_status = 'processing' AND i.order_lease_expires_at <= clock_timestamp())
      )
    ORDER BY i.created_at, i.id
    LIMIT 1
    FOR UPDATE OF i SKIP LOCKED;

  IF NOT FOUND THEN RETURN; END IF;

  PERFORM set_config('kablet.organization_id', work.organization_id::text, true);
  PERFORM set_config('kablet.business_id', work.business_id::text, true);

  UPDATE kablet_native_payment_webhook_inbox AS i
     SET order_status = 'processing',
         order_attempt_count = work.order_attempt_count + 1,
         order_worker_id = p_worker_id,
         order_lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
         order_next_attempt_at = NULL,
         order_last_error_code = NULL
   WHERE id = work.id;

  RETURN QUERY SELECT work.id, work.organization_id, work.business_id, work.store_id,
                      work.payment_id, work.order_attempt_count + 1;
END;
$$;

CREATE OR REPLACE FUNCTION kablet_complete_native_verified_order_work(
  p_evidence_id uuid,
  p_worker_id varchar,
  p_result varchar,
  p_error_code varchar DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT NULL
) RETURNS TABLE(updated boolean, order_status varchar)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  next_status varchar := p_result;
  work record;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'verified order worker authority is required';
  END IF;
  IF p_result NOT IN ('processed','retryable','recovery','dead_letter')
     OR p_worker_id IS NULL OR length(trim(p_worker_id)) = 0
     OR (p_result = 'retryable' AND (p_retry_after_seconds IS NULL OR p_retry_after_seconds < 1 OR p_retry_after_seconds > 3600)) THEN
    RAISE EXCEPTION 'verified order worker completion is invalid';
  END IF;

  SELECT organization_id, business_id INTO work
    FROM kablet_native_payment_webhook_inbox
   WHERE kablet_native_payment_webhook_inbox.id = p_evidence_id
     AND kablet_native_payment_webhook_inbox.order_status = 'processing'
     AND kablet_native_payment_webhook_inbox.order_worker_id = p_worker_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, next_status;
    RETURN;
  END IF;
  PERFORM set_config('kablet.organization_id', work.organization_id::text, true);
  PERFORM set_config('kablet.business_id', work.business_id::text, true);

  UPDATE kablet_native_payment_webhook_inbox AS i
     SET order_status = next_status,
         order_worker_id = NULL,
         order_lease_expires_at = NULL,
         order_next_attempt_at = CASE WHEN next_status = 'retryable'
           THEN clock_timestamp() + make_interval(secs => p_retry_after_seconds)
           ELSE NULL END,
         order_last_error_code = NULLIF(left(coalesce(p_error_code, ''), 100), ''),
         order_processed_at = CASE WHEN next_status IN ('processed','recovery','dead_letter') THEN clock_timestamp() ELSE NULL END
   WHERE i.id = p_evidence_id AND i.order_status = 'processing' AND i.order_worker_id = p_worker_id;

  RETURN QUERY SELECT FOUND, next_status;
END;
$$;

REVOKE ALL ON FUNCTION kablet_claim_native_verified_order_work(varchar, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION kablet_complete_native_verified_order_work(uuid, varchar, varchar, varchar, integer) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT ON kablet_native_payment_evidence TO kablet_control;
    GRANT EXECUTE ON FUNCTION kablet_ingest_verified_native_payment_evidence(uuid, uuid, uuid, uuid, uuid, varchar, varchar, varchar, bytea, uuid, varchar, numeric, varchar, varchar, timestamptz) TO kablet_control;
    GRANT EXECUTE ON FUNCTION kablet_claim_native_verified_order_work(varchar, integer, integer) TO kablet_control;
    GRANT EXECUTE ON FUNCTION kablet_complete_native_verified_order_work(uuid, varchar, varchar, varchar, integer) TO kablet_control;
  END IF;
END $$;
