-- Stripe BYOP authenticated-ingestion boundary.
-- Cryptographic verification occurs in the server-only adapter before this
-- function is called. The database function is the only ordinary application
-- path that can persist verified native payment evidence.

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
LANGUAGE plpgsql
SECURITY DEFINER
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
    processing_status, attempt_count, occurred_at
  ) VALUES (
    p_evidence_id, p_organization_id, p_business_id, p_store_id,
    p_merchant_payment_account_id, p_provider_event_id, p_event_type,
    p_provider_object_reference, p_payload_digest, 'verified',
    'accepted', 1, p_observed_at
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
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT EXECUTE ON FUNCTION kablet_ingest_verified_native_payment_evidence(uuid, uuid, uuid, uuid, uuid, varchar, varchar, varchar, bytea, uuid, varchar, numeric, varchar, varchar, timestamptz) TO kablet_control;
  END IF;
END $$;
