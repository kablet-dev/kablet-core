-- Narrow reconciliation authority for quarantined reservations.

-- The reservation table's existing uniqueness is checkout-scoped. Add the
-- tenant-scoped reservation identity required by the reconciliation audit FK.
ALTER TABLE kablet_native_inventory_reservations
  ADD CONSTRAINT kablet_native_inventory_reservations_tenant_id_key
  UNIQUE (organization_id, business_id, store_id, id);

CREATE TABLE IF NOT EXISTS kablet_native_reservation_reconciliations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  resolution_evidence_id uuid NOT NULL,
  decision varchar(16) NOT NULL CHECK (decision = 'released'),
  authority_actor varchar(300) NOT NULL,
  authority_role varchar(128) NOT NULL,
  reason varchar(500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, reservation_id),
  FOREIGN KEY (organization_id, business_id, store_id, reservation_id)
    REFERENCES kablet_native_inventory_reservations(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, resolution_evidence_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_evidence(organization_id, business_id, store_id, id, payment_id, merchant_payment_account_id)
    ON DELETE RESTRICT
);

ALTER TABLE kablet_native_reservation_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_reservation_reconciliations FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_native_reservation_reconciliation_tenant_isolation
  ON kablet_native_reservation_reconciliations
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

CREATE OR REPLACE FUNCTION kablet_reconcile_unknown_reservation(
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_reservation_id uuid,
  p_evidence_id uuid,
  p_reason varchar
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  reservation_row record;
  payment_row record;
BEGIN
  PERFORM set_config('kablet.organization_id', p_organization_id::text, true);
  PERFORM set_config('kablet.business_id', p_business_id::text, true);
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'reconciliation reason is invalid';
  END IF;

  -- Lock payment first, then reservation. Payment-state writers and this
  -- reconciliation path must use the same order to prevent a release decision
  -- racing a later authenticated provider result.
  SELECT p.id, p.checkout_id, p.merchant_payment_account_id, p.amount_minor,
         p.currency, p.provider_payment_reference, p.status,
         e.id AS evidence_id, e.payment_status AS evidence_status,
         e.provider_payment_reference AS evidence_provider_reference
    INTO payment_row
    FROM kablet_native_payment_evidence e
    JOIN kablet_native_payment_attempts p
      ON p.organization_id = e.organization_id AND p.business_id = e.business_id
     AND p.store_id = e.store_id AND p.id = e.payment_id
     AND p.merchant_payment_account_id = e.merchant_payment_account_id
   WHERE e.id = p_evidence_id
     AND e.organization_id = p_organization_id
     AND e.business_id = p_business_id
     AND e.store_id = p_store_id
     AND e.verification_status = 'verified'
   FOR UPDATE OF p;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authenticated matching payment evidence is required';
  END IF;

  IF payment_row.status NOT IN ('failed', 'cancelled')
     OR payment_row.evidence_status <> payment_row.status
     OR payment_row.provider_payment_reference IS NULL
     OR payment_row.evidence_provider_reference <> payment_row.provider_payment_reference THEN
    RAISE EXCEPTION 'payment attempt is not definitively non-paid';
  END IF;

  SELECT r.organization_id, r.business_id, r.store_id, r.checkout_id
    INTO reservation_row
    FROM kablet_native_inventory_reservations r
   WHERE r.organization_id = p_organization_id AND r.business_id = p_business_id
     AND r.store_id = p_store_id AND r.id = p_reservation_id
     AND r.checkout_id = payment_row.checkout_id AND r.status = 'unknown'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation is not an unresolved quarantine';
  END IF;

  -- A later success, or a refund following a success, is not safe evidence
  -- for releasing quarantined inventory in this pre-order slice.
  IF EXISTS (
    SELECT 1
      FROM kablet_native_payment_evidence e
     WHERE e.organization_id = p_organization_id
       AND e.business_id = p_business_id
       AND e.store_id = p_store_id
       AND e.payment_id = payment_row.id
       AND e.merchant_payment_account_id = payment_row.merchant_payment_account_id
       AND e.verification_status = 'verified'
       AND e.payment_status IN ('authorized', 'captured', 'refunded')
  ) THEN
    RAISE EXCEPTION 'successful or refunded payment evidence prevents quarantine release';
  END IF;

  INSERT INTO kablet_native_reservation_reconciliations (
    id, organization_id, business_id, store_id, reservation_id, payment_id,
    merchant_payment_account_id, resolution_evidence_id, decision,
    authority_actor, authority_role, reason
  ) VALUES (
    p_reservation_id, reservation_row.organization_id, reservation_row.business_id,
    reservation_row.store_id, p_reservation_id, payment_row.id,
    payment_row.merchant_payment_account_id, payment_row.evidence_id, 'released',
    session_user, current_user, p_reason
  );

  UPDATE kablet_native_payment_attempts
     SET status = 'reconciled', last_verified_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE id = payment_row.id
     AND organization_id = p_organization_id
     AND business_id = p_business_id
     AND store_id = p_store_id;

  UPDATE kablet_native_inventory_reservations
     SET status = 'released', released_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE id = p_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION kablet_native_payment_attempt_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'reconciled' AND NEW.status <> 'reconciled' THEN
    RAISE EXCEPTION 'reconciled payment attempt cannot transition';
  END IF;
  IF OLD.status IN ('authorized', 'captured')
     AND NEW.status NOT IN ('authorized', 'captured') THEN
    RAISE EXCEPTION 'paid payment attempt cannot transition to a non-paid state';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kablet_native_payment_attempt_transition_guard_trigger
  BEFORE UPDATE ON kablet_native_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION kablet_native_payment_attempt_transition_guard();

-- Verified evidence writers must serialize behind the same payment lock used
-- by reconciliation. This prevents a later authenticated success from being
-- committed after a release decision has already inspected the evidence set.
CREATE OR REPLACE FUNCTION kablet_native_verified_evidence_lock_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  payment_reference varchar;
BEGIN
  IF NEW.verification_status <> 'verified' THEN
    RETURN NEW;
  END IF;

  SELECT p.provider_payment_reference
    INTO payment_reference
    FROM kablet_native_payment_attempts p
   WHERE p.organization_id = NEW.organization_id
     AND p.business_id = NEW.business_id
     AND p.store_id = NEW.store_id
     AND p.id = NEW.payment_id
     AND p.merchant_payment_account_id = NEW.merchant_payment_account_id
   FOR UPDATE;

  IF NOT FOUND OR payment_reference IS NULL
     OR NEW.provider_payment_reference <> payment_reference THEN
    RAISE EXCEPTION 'verified evidence must match the payment attempt reference';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION kablet_native_verified_evidence_lock_payment() FROM PUBLIC;
CREATE TRIGGER kablet_native_verified_evidence_lock_payment_trigger
  BEFORE INSERT ON kablet_native_payment_evidence
  FOR EACH ROW EXECUTE FUNCTION kablet_native_verified_evidence_lock_payment();

CREATE OR REPLACE FUNCTION kablet_create_native_payment_attempt(
  p_payment_id uuid,
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_checkout_id uuid,
  p_merchant_payment_account_id uuid,
  p_idempotency_key_hash bytea,
  p_operation_id varchar,
  p_capture_mode varchar
) RETURNS TABLE(payment_id uuid, checkout_revision integer, amount_minor numeric, currency varchar, idempotent boolean, created_at timestamptz, updated_at timestamptz, status varchar, unknown_at timestamptz, last_verified_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  account_row record;
  checkout_row record;
  existing_row record;
BEGIN
  IF octet_length(p_idempotency_key_hash) <> 32 OR p_operation_id IS NULL OR length(trim(p_operation_id)) = 0 THEN
    RAISE EXCEPTION 'payment attempt identity is invalid';
  END IF;
  IF p_capture_mode NOT IN ('authorize_only', 'authorize_and_capture') THEN
    RAISE EXCEPTION 'payment capture mode is invalid';
  END IF;
  PERFORM set_config('kablet.organization_id', p_organization_id::text, true);
  PERFORM set_config('kablet.business_id', p_business_id::text, true);

  SELECT a.id, a.status, a.supported_currencies, a.can_authorize, a.can_capture
    INTO account_row
    FROM kablet_native_payment_accounts a
   WHERE a.organization_id = p_organization_id AND a.business_id = p_business_id
     AND a.store_id = p_store_id AND a.id = p_merchant_payment_account_id;
  IF NOT FOUND OR account_row.status <> 'active' OR NOT account_row.can_authorize
     OR (p_capture_mode = 'authorize_and_capture' AND NOT account_row.can_capture) THEN
    RAISE EXCEPTION 'merchant payment account is not eligible';
  END IF;

  SELECT c.id, c.checkout_revision, c.currency, c.server_total_state, c.server_total_amount_minor
    INTO checkout_row
    FROM kablet_native_checkout_sessions c
   WHERE c.organization_id = p_organization_id AND c.business_id = p_business_id
     AND c.store_id = p_store_id AND c.id = p_checkout_id;
  IF NOT FOUND OR checkout_row.server_total_state <> 'calculated'
     OR NOT (account_row.supported_currencies @> ARRAY[checkout_row.currency]::varchar[]) THEN
    RAISE EXCEPTION 'checkout amount or currency is not eligible';
  END IF;

  INSERT INTO kablet_native_payment_attempts (
    id, organization_id, business_id, store_id, checkout_id, checkout_revision,
    merchant_payment_account_id, amount_minor, currency, operation_id,
    idempotency_key_hash, status
  ) VALUES (
    p_payment_id, p_organization_id, p_business_id, p_store_id, p_checkout_id,
    checkout_row.checkout_revision, p_merchant_payment_account_id,
    checkout_row.server_total_amount_minor, checkout_row.currency, p_operation_id,
    p_idempotency_key_hash, 'created'
  ) ON CONFLICT (organization_id, business_id, store_id, checkout_id, merchant_payment_account_id, idempotency_key_hash)
    DO NOTHING;

  IF FOUND THEN
    RETURN QUERY SELECT pa.id, pa.checkout_revision, pa.amount_minor, pa.currency, false, pa.created_at, pa.updated_at, pa.status, pa.unknown_at, pa.last_verified_at
      FROM kablet_native_payment_attempts pa WHERE pa.id = p_payment_id;
    RETURN;
  END IF;

  SELECT pa.id, pa.checkout_revision, pa.amount_minor, pa.currency, pa.operation_id
    INTO existing_row
    FROM kablet_native_payment_attempts pa
   WHERE pa.organization_id = p_organization_id AND pa.business_id = p_business_id
     AND pa.store_id = p_store_id AND pa.checkout_id = p_checkout_id
     AND pa.merchant_payment_account_id = p_merchant_payment_account_id
     AND pa.idempotency_key_hash = p_idempotency_key_hash;
  IF NOT FOUND OR existing_row.operation_id <> p_operation_id THEN
    RAISE EXCEPTION 'payment idempotency conflict';
  END IF;
  RETURN QUERY SELECT pa.id, pa.checkout_revision, pa.amount_minor, pa.currency, true, pa.created_at, pa.updated_at, pa.status, pa.unknown_at, pa.last_verified_at
    FROM kablet_native_payment_attempts pa WHERE pa.id = existing_row.id;
END;
$$;

REVOKE ALL ON FUNCTION kablet_create_native_payment_attempt(uuid, uuid, uuid, uuid, uuid, uuid, bytea, varchar, varchar) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT EXECUTE ON FUNCTION kablet_create_native_payment_attempt(uuid, uuid, uuid, uuid, uuid, uuid, bytea, varchar, varchar) TO kablet_dev;
  END IF;
END $$;

REVOKE ALL ON FUNCTION kablet_reconcile_unknown_reservation(uuid, uuid, uuid, uuid, uuid, varchar) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT EXECUTE ON FUNCTION kablet_reconcile_unknown_reservation(uuid, uuid, uuid, uuid, uuid, varchar) TO kablet_control;
    GRANT SELECT ON kablet_native_reservation_reconciliations TO kablet_control;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT ON kablet_native_reservation_reconciliations TO kablet_test_bootstrap;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION kablet_native_reservation_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id OR NEW.business_id <> OLD.business_id
     OR NEW.store_id <> OLD.store_id OR NEW.checkout_id <> OLD.checkout_id
     OR NEW.checkout_line_id <> OLD.checkout_line_id OR NEW.product_id <> OLD.product_id
     OR NEW.sku_snapshot <> OLD.sku_snapshot OR NEW.quantity <> OLD.quantity
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'inventory reservation identity is immutable';
  END IF;
  IF OLD.status IN ('committed', 'released', 'expired') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'terminal inventory reservation cannot transition';
  END IF;
  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'committed', 'released', 'expired', 'unknown') THEN
    RAISE EXCEPTION 'invalid active inventory reservation transition';
  END IF;
  IF OLD.status = 'unknown' AND NEW.status <> 'unknown'
     AND NOT has_function_privilege(current_user, 'public.kablet_reconcile_unknown_reservation(uuid,uuid,uuid,uuid,uuid,character varying)', 'EXECUTE') THEN
    RAISE EXCEPTION 'unknown inventory reservation requires reconciliation authority';
  END IF;
  RETURN NEW;
END;
$$;
