-- Bind a Stripe PaymentIntent only after the server has retrieved and validated
-- the payment attempt's stored Checkout Session. Ordinary runtime roles cannot
-- mutate provider identity fields; the restricted control role owns this step.
CREATE OR REPLACE FUNCTION kablet_bind_native_payment_reference(
  p_payment_id uuid,
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_merchant_payment_account_id uuid,
  p_provider_session_reference varchar,
  p_provider_payment_reference varchar
) RETURNS TABLE(payment_id uuid, checkout_id uuid, amount_minor numeric, currency varchar, provider_payment_reference varchar, provider_session_reference varchar, idempotent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_session varchar;
  current_payment varchar;
  current_checkout uuid;
  current_amount numeric;
  current_currency varchar;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'payment reference binding authority is required';
  END IF;
  IF p_provider_session_reference IS NULL OR p_provider_session_reference !~ '^cs_[A-Za-z0-9_]+$'
     OR p_provider_payment_reference IS NULL OR p_provider_payment_reference !~ '^pi_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'payment provider references are invalid';
  END IF;

  SELECT pa.provider_session_reference, pa.provider_payment_reference, pa.checkout_id, pa.amount_minor, pa.currency
    INTO current_session, current_payment, current_checkout, current_amount, current_currency
    FROM kablet_native_payment_attempts pa
   WHERE pa.id = p_payment_id
     AND pa.organization_id = p_organization_id
     AND pa.business_id = p_business_id
     AND pa.store_id = p_store_id
     AND pa.merchant_payment_account_id = p_merchant_payment_account_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment attempt not found'; END IF;
  IF current_session IS NULL OR current_session <> p_provider_session_reference THEN RAISE EXCEPTION 'payment session reference conflict'; END IF;
  IF current_payment IS NOT NULL THEN
    IF current_payment <> p_provider_payment_reference THEN RAISE EXCEPTION 'payment reference conflict'; END IF;
    RETURN QUERY SELECT p_payment_id, current_checkout, current_amount, current_currency, current_payment, current_session, true;
    RETURN;
  END IF;

  UPDATE kablet_native_payment_attempts pa
     SET provider_payment_reference = p_provider_payment_reference,
         updated_at = clock_timestamp()
   WHERE pa.id = p_payment_id
     AND pa.organization_id = p_organization_id
     AND pa.business_id = p_business_id
     AND pa.store_id = p_store_id
     AND pa.merchant_payment_account_id = p_merchant_payment_account_id
     AND pa.provider_payment_reference IS NULL;
  RETURN QUERY SELECT p_payment_id, current_checkout, current_amount, current_currency, p_provider_payment_reference, current_session, false;
END;
$$;

REVOKE ALL ON FUNCTION kablet_bind_native_payment_reference(uuid, uuid, uuid, uuid, uuid, varchar, varchar) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT EXECUTE ON FUNCTION kablet_bind_native_payment_reference(uuid, uuid, uuid, uuid, uuid, varchar, varchar) TO kablet_control;
  END IF;
END $$;
