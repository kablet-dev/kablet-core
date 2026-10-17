-- Provider-neutral, exactly-once verified-order commitment.
-- Only kablet_control may execute the commitment function. A successful
-- commitment is the only path in this slice that decrements inventory.

CREATE TABLE IF NOT EXISTS kablet_native_orders (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  public_reference varchar(40) NOT NULL,
  checkout_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  fulfillment_type varchar(16) NOT NULL CHECK (fulfillment_type IN ('physical','digital','mixed')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_amount_minor numeric(30,0) NOT NULL CHECK (subtotal_amount_minor >= 0),
  shipping_amount_minor numeric(30,0) NOT NULL CHECK (shipping_amount_minor >= 0),
  tax_amount_minor numeric(30,0) NOT NULL CHECK (tax_amount_minor >= 0),
  total_amount_minor numeric(30,0) NOT NULL CHECK (total_amount_minor >= 0),
  commitment_key_hash bytea NOT NULL CHECK (octet_length(commitment_key_hash) = 32),
  payment_status varchar(24) NOT NULL DEFAULT 'verified_captured' CHECK (payment_status = 'verified_captured'),
  fulfillment_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending','processing','fulfilled','cancelled')),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, public_reference),
  UNIQUE (organization_id, business_id, store_id, payment_id),
  UNIQUE (organization_id, business_id, store_id, checkout_id),
  UNIQUE (organization_id, business_id, store_id, payment_id, commitment_key_hash),
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_attempts(organization_id, business_id, store_id, id, merchant_payment_account_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, evidence_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_evidence(organization_id, business_id, store_id, id, payment_id, merchant_payment_account_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS kablet_native_order_lines (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  fulfillment_type varchar(16) NOT NULL CHECK (fulfillment_type IN ('physical','digital')),
  sku_snapshot varchar(100) NOT NULL CHECK (sku_snapshot ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_amount_minor numeric(30,0) NOT NULL CHECK (unit_amount_minor >= 0),
  line_amount_minor numeric(30,0) NOT NULL CHECK (line_amount_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  price_revision integer NOT NULL CHECK (price_revision > 0),
  product_title_snapshot varchar(200) NOT NULL,
  shipping_amount_minor numeric(30,0) NOT NULL CHECK (shipping_amount_minor >= 0),
  tax_amount_minor numeric(30,0) NOT NULL CHECK (tax_amount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, order_id, id),
  UNIQUE (organization_id, business_id, store_id, order_id, product_id),
  FOREIGN KEY (organization_id, business_id, store_id, order_id)
    REFERENCES kablet_native_orders(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, product_id)
    REFERENCES kablet_native_products(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  CHECK (line_amount_minor = unit_amount_minor * quantity)
);

CREATE TABLE IF NOT EXISTS kablet_native_order_commitment_recoveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  merchant_payment_account_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  reason varchar(32) NOT NULL CHECK (reason IN ('reservation_expired','inventory_unavailable','quarantined_reservation','invalid_checkout','payment_state_uncertain')),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','investigating','escalated','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, payment_id),
  FOREIGN KEY (organization_id, business_id, store_id, payment_id)
    REFERENCES kablet_native_payment_attempts(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, store_id, evidence_id, payment_id, merchant_payment_account_id)
    REFERENCES kablet_native_payment_evidence(organization_id, business_id, store_id, id, payment_id, merchant_payment_account_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS kablet_native_orders_payment_idx
  ON kablet_native_orders(organization_id, business_id, store_id, payment_id);
CREATE INDEX IF NOT EXISTS kablet_native_order_lines_order_idx
  ON kablet_native_order_lines(organization_id, business_id, store_id, order_id);
CREATE INDEX IF NOT EXISTS kablet_native_order_recoveries_pending_idx
  ON kablet_native_order_commitment_recoveries(organization_id, business_id, store_id, status, updated_at);

ALTER TABLE kablet_native_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_order_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_order_commitment_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_order_commitment_recoveries FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_orders_tenant_isolation ON kablet_native_orders
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_order_lines_tenant_isolation ON kablet_native_order_lines
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_order_recoveries_tenant_isolation ON kablet_native_order_commitment_recoveries
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

CREATE OR REPLACE FUNCTION kablet_native_order_identity_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organization_id <> NEW.organization_id OR OLD.business_id <> NEW.business_id OR OLD.store_id <> NEW.store_id
     OR OLD.checkout_id <> NEW.checkout_id OR OLD.cart_id <> NEW.cart_id OR OLD.payment_id <> NEW.payment_id
     OR OLD.merchant_payment_account_id <> NEW.merchant_payment_account_id OR OLD.evidence_id <> NEW.evidence_id
     OR OLD.currency <> NEW.currency OR OLD.subtotal_amount_minor <> NEW.subtotal_amount_minor
     OR OLD.shipping_amount_minor <> NEW.shipping_amount_minor OR OLD.tax_amount_minor <> NEW.tax_amount_minor
     OR OLD.total_amount_minor <> NEW.total_amount_minor OR OLD.commitment_key_hash <> NEW.commitment_key_hash
     OR OLD.payment_status <> NEW.payment_status OR OLD.verified_at <> NEW.verified_at THEN
    RAISE EXCEPTION 'verified order identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kablet_native_order_identity_immutable_trigger
  BEFORE UPDATE ON kablet_native_orders FOR EACH ROW EXECUTE FUNCTION kablet_native_order_identity_immutable();

CREATE OR REPLACE FUNCTION kablet_native_order_line_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'verified order lines are immutable';
END;
$$;
CREATE TRIGGER kablet_native_order_line_immutable_trigger
  BEFORE UPDATE OR DELETE ON kablet_native_order_lines FOR EACH ROW EXECUTE FUNCTION kablet_native_order_line_immutable();

CREATE OR REPLACE FUNCTION kablet_commit_verified_native_order(
  p_organization_id uuid,
  p_business_id uuid,
  p_store_id uuid,
  p_payment_id uuid,
  p_evidence_id uuid,
  p_commitment_key_hash bytea
) RETURNS TABLE(order_id uuid, public_reference varchar, idempotent boolean, recovery_required boolean, recovery_id uuid, recovery_reason varchar)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  p record;
  c record;
  e record;
  l record;
  product record;
  reservation record;
  existing record;
  new_order_id uuid;
  new_recovery_id uuid;
  new_public_reference varchar;
  line_number integer := 0;
  subtotal numeric := 0;
  shipping numeric := 0;
  tax numeric := 0;
  total numeric := 0;
  recovery_reason_value varchar;
BEGIN
  IF session_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'verified order commitment authority is required';
  END IF;
  IF p_commitment_key_hash IS NULL OR octet_length(p_commitment_key_hash) <> 32 THEN
    RAISE EXCEPTION 'commitment identity is invalid';
  END IF;
  PERFORM set_config('kablet.organization_id', p_organization_id::text, true);
  PERFORM set_config('kablet.business_id', p_business_id::text, true);

  SELECT * INTO p FROM kablet_native_payment_attempts
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=p_payment_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment attempt not found'; END IF;

  SELECT o.id, o.public_reference, o.evidence_id INTO existing FROM kablet_native_orders o
   WHERE o.organization_id=p_organization_id AND o.business_id=p_business_id AND o.store_id=p_store_id AND o.payment_id=p_payment_id
   FOR UPDATE;
  IF FOUND THEN
    IF existing.evidence_id <> p_evidence_id THEN RAISE EXCEPTION 'payment already committed with different evidence'; END IF;
    RETURN QUERY SELECT existing.id, existing.public_reference, true, false, NULL::uuid, NULL::varchar;
    RETURN;
  END IF;

  SELECT * INTO e FROM kablet_native_payment_evidence
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=p_evidence_id
     AND payment_id=p_payment_id AND merchant_payment_account_id=p.merchant_payment_account_id
   FOR SHARE;
  IF NOT FOUND OR e.verification_status <> 'verified' OR e.payment_status <> 'captured'
     OR e.provider_payment_reference IS NULL OR p.provider_payment_reference IS NULL
     OR e.provider_payment_reference <> p.provider_payment_reference
     OR e.provider_object_reference <> p.provider_payment_reference
     OR e.amount_minor <> p.amount_minor OR e.currency <> p.currency THEN
    RAISE EXCEPTION 'captured payment evidence does not match payment attempt';
  END IF;
  IF p.status NOT IN ('created','session_created','pending','authorized','captured') THEN
    INSERT INTO kablet_native_order_commitment_recoveries (
      id, organization_id, business_id, store_id, payment_id, merchant_payment_account_id, checkout_id, evidence_id, reason
    ) VALUES (gen_random_uuid(), p_organization_id, p_business_id, p_store_id, p.id, p.merchant_payment_account_id, p.checkout_id, e.id, 'payment_state_uncertain')
    ON CONFLICT (organization_id, business_id, store_id, payment_id) DO UPDATE SET updated_at=clock_timestamp()
    RETURNING id INTO new_recovery_id;
    RETURN QUERY SELECT NULL::uuid, NULL::varchar, false, true, new_recovery_id, 'payment_state_uncertain'::varchar;
    RETURN;
  END IF;

  SELECT * INTO c FROM kablet_native_checkout_sessions
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=p.checkout_id
   FOR UPDATE;
  IF NOT FOUND OR c.checkout_revision <> p.checkout_revision OR c.status NOT IN ('reserved','payment_pending','payment_unknown')
     OR c.server_total_state <> 'calculated' OR c.server_total_amount_minor IS NULL OR c.server_total_currency <> p.currency THEN
    RAISE EXCEPTION 'checkout is not eligible for verified order commitment';
  END IF;

  SELECT COALESCE(sum(line_amount_minor),0), count(*) INTO subtotal, line_number
    FROM kablet_native_checkout_lines
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND checkout_id=p.checkout_id;
  IF line_number = 0 THEN RAISE EXCEPTION 'checkout has no lines'; END IF;
  shipping := CASE WHEN c.shipping_charge_state='calculated' THEN c.shipping_charge_amount_minor ELSE 0 END;
  tax := CASE WHEN c.tax_state='calculated' THEN c.tax_amount_minor ELSE 0 END;
  total := subtotal + shipping + tax;
  IF total <> c.server_total_amount_minor OR total <> p.amount_minor THEN RAISE EXCEPTION 'authoritative checkout total mismatch'; END IF;

  -- Lock every product in product-id order before changing any inventory.
  FOR l IN SELECT * FROM kablet_native_checkout_lines
    WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND checkout_id=p.checkout_id
    ORDER BY product_id, id
  LOOP
    IF l.line_amount_minor <> l.unit_amount_minor * l.quantity OR l.currency_snapshot <> p.currency
       OR l.price_revision_snapshot <= 0 THEN
      recovery_reason_value := 'invalid_checkout'; EXIT;
    END IF;
    SELECT * INTO product FROM kablet_native_products
     WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=l.product_id
     FOR UPDATE;
    IF NOT FOUND OR product.currency <> l.currency_snapshot OR product.sku <> l.sku_snapshot THEN
      recovery_reason_value := 'invalid_checkout'; EXIT;
    END IF;
    IF l.fulfillment_type = 'physical' THEN
      IF product.inventory_quantity IS NULL OR product.inventory_quantity < l.quantity THEN
        recovery_reason_value := 'inventory_unavailable';
        EXIT;
      END IF;
      SELECT * INTO reservation FROM kablet_native_inventory_reservations
       WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id
         AND checkout_id=p.checkout_id AND checkout_line_id=l.id AND product_id=l.product_id
       FOR UPDATE;
      IF NOT FOUND OR reservation.status NOT IN ('active','unknown') THEN
        recovery_reason_value := 'invalid_checkout'; EXIT;
      END IF;
      IF reservation.status = 'unknown' THEN
        recovery_reason_value := 'quarantined_reservation'; EXIT;
      END IF;
      IF reservation.quantity <> l.quantity OR reservation.sku_snapshot <> l.sku_snapshot THEN
        recovery_reason_value := 'invalid_checkout'; EXIT;
      END IF;
      IF reservation.expires_at <= clock_timestamp() THEN
        recovery_reason_value := CASE WHEN reservation.status='unknown' THEN 'quarantined_reservation' ELSE 'reservation_expired' END;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF recovery_reason_value IS NOT NULL THEN
    INSERT INTO kablet_native_order_commitment_recoveries (
      id, organization_id, business_id, store_id, payment_id, merchant_payment_account_id, checkout_id, evidence_id, reason
    ) VALUES (gen_random_uuid(), p_organization_id, p_business_id, p_store_id, p.id, p.merchant_payment_account_id, p.checkout_id, e.id, recovery_reason_value)
    ON CONFLICT (organization_id, business_id, store_id, payment_id) DO UPDATE SET updated_at=clock_timestamp()
    RETURNING id INTO new_recovery_id;
    RETURN QUERY SELECT NULL::uuid, NULL::varchar, false, true, new_recovery_id, recovery_reason_value;
    RETURN;
  END IF;

  new_order_id := gen_random_uuid();
  new_public_reference := 'KBL-' || upper(replace(new_order_id::text, '-', ''));
  INSERT INTO kablet_native_orders (
    id, organization_id, business_id, store_id, public_reference, checkout_id, cart_id, payment_id,
    merchant_payment_account_id, evidence_id, fulfillment_type, currency, subtotal_amount_minor,
    shipping_amount_minor, tax_amount_minor, total_amount_minor, commitment_key_hash, verified_at
  ) VALUES (
    new_order_id, p_organization_id, p_business_id, p_store_id, new_public_reference, c.id, c.cart_id, p.id,
    p.merchant_payment_account_id, e.id,
    CASE WHEN EXISTS (SELECT 1 FROM kablet_native_checkout_lines x WHERE x.checkout_id=c.id AND x.fulfillment_type='physical')
      AND EXISTS (SELECT 1 FROM kablet_native_checkout_lines x WHERE x.checkout_id=c.id AND x.fulfillment_type='digital') THEN 'mixed'
      WHEN EXISTS (SELECT 1 FROM kablet_native_checkout_lines x WHERE x.checkout_id=c.id AND x.fulfillment_type='physical') THEN 'physical' ELSE 'digital' END,
    p.currency, subtotal, shipping, tax, total, p_commitment_key_hash, e.verified_at
  );

  line_number := 0;
  FOR l IN SELECT * FROM kablet_native_checkout_lines
    WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND checkout_id=p.checkout_id
    ORDER BY product_id, id
  LOOP
    INSERT INTO kablet_native_order_lines (
      id, organization_id, business_id, store_id, order_id, product_id, fulfillment_type, sku_snapshot, quantity,
      unit_amount_minor, line_amount_minor, currency, price_revision, product_title_snapshot, shipping_amount_minor, tax_amount_minor
    ) VALUES (
      gen_random_uuid(), p_organization_id, p_business_id, p_store_id, new_order_id, l.product_id, l.fulfillment_type, l.sku_snapshot,
      l.quantity, l.unit_amount_minor, l.line_amount_minor, l.currency_snapshot, l.price_revision_snapshot, l.product_title_snapshot,
      CASE WHEN line_number=0 THEN shipping ELSE 0 END, CASE WHEN line_number=0 THEN tax ELSE 0 END
    );
    line_number := line_number + 1;
    IF l.fulfillment_type = 'physical' THEN
      UPDATE kablet_native_products SET inventory_quantity=inventory_quantity-l.quantity, availability=CASE WHEN inventory_quantity-l.quantity=0 THEN 'unavailable' ELSE availability END, inventory_updated_at=clock_timestamp(), updated_at=clock_timestamp()
       WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=l.product_id AND inventory_quantity >= l.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'inventory changed during commitment'; END IF;
      UPDATE kablet_native_inventory_reservations SET status='committed', committed_at=clock_timestamp(), updated_at=clock_timestamp()
       WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND checkout_id=p.checkout_id AND checkout_line_id=l.id AND status IN ('active','unknown');
      IF NOT FOUND THEN RAISE EXCEPTION 'reservation changed during commitment'; END IF;
    END IF;
  END LOOP;
  UPDATE kablet_native_checkout_sessions SET status='completed', updated_at=clock_timestamp()
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=c.id;
  UPDATE kablet_native_payment_attempts SET status='captured', last_verified_at=e.verified_at, updated_at=clock_timestamp()
   WHERE organization_id=p_organization_id AND business_id=p_business_id AND store_id=p_store_id AND id=p.id;
  RETURN QUERY SELECT new_order_id, new_public_reference, false, false, NULL::uuid, NULL::varchar;
END;
$$;

REVOKE ALL ON FUNCTION kablet_commit_verified_native_order(uuid, uuid, uuid, uuid, uuid, bytea) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT EXECUTE ON FUNCTION kablet_commit_verified_native_order(uuid, uuid, uuid, uuid, uuid, bytea) TO kablet_control;
    GRANT SELECT ON kablet_native_orders, kablet_native_order_lines, kablet_native_order_commitment_recoveries TO kablet_control;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_orders, kablet_native_order_lines, kablet_native_order_commitment_recoveries TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_orders, kablet_native_order_lines, kablet_native_order_commitment_recoveries TO kablet_test_bootstrap;
  END IF;
END $$;
