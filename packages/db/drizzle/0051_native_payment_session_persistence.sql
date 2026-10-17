-- Persist the trusted Stripe Checkout Session reference through the control boundary.
-- The ordinary runtime role may create attempts through its narrow creation function,
-- but may not mutate provider identity fields directly.
CREATE OR REPLACE FUNCTION kablet_record_native_payment_session(
  p_payment_id uuid,
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_merchant_payment_account_id uuid,
  p_provider_session_reference varchar
) RETURNS TABLE(provider_session_reference varchar, idempotent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_session varchar;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'payment session persistence authority is required';
  END IF;
  PERFORM set_config('kablet.organization_id', p_organization_id::text, true);
  PERFORM set_config('kablet.business_id', p_business_id::text, true);
  IF p_provider_session_reference IS NULL OR p_provider_session_reference !~ '^cs_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'payment session reference is invalid';
  END IF;

  SELECT pa.provider_session_reference
    INTO current_session
    FROM kablet_native_payment_attempts pa
   WHERE pa.id = p_payment_id
     AND pa.organization_id = p_organization_id
     AND pa.business_id = p_business_id
     AND pa.store_id = p_store_id
     AND pa.merchant_payment_account_id = p_merchant_payment_account_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment attempt not found'; END IF;
  IF current_session IS NOT NULL THEN
    IF current_session <> p_provider_session_reference THEN RAISE EXCEPTION 'payment session reference conflict'; END IF;
    RETURN QUERY SELECT current_session, true;
    RETURN;
  END IF;

  UPDATE kablet_native_payment_attempts pa
     SET provider_session_reference = p_provider_session_reference,
         status = CASE WHEN pa.status = 'created' THEN 'session_created' ELSE pa.status END,
         updated_at = clock_timestamp()
   WHERE pa.id = p_payment_id
     AND pa.organization_id = p_organization_id
     AND pa.business_id = p_business_id
     AND pa.store_id = p_store_id
     AND pa.merchant_payment_account_id = p_merchant_payment_account_id
     AND pa.provider_session_reference IS NULL;
  RETURN QUERY SELECT p_provider_session_reference, false;
END;
$$;

REVOKE ALL ON FUNCTION kablet_record_native_payment_session(uuid, uuid, uuid, uuid, uuid, varchar) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT EXECUTE ON FUNCTION kablet_record_native_payment_session(uuid, uuid, uuid, uuid, uuid, varchar) TO kablet_control;
  END IF;
END $$;
