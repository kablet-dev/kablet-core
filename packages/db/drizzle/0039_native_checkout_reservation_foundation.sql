-- Native physical checkout and reservation contracts only.
-- This migration does not start payments, create orders, or mutate inventory.

CREATE TABLE IF NOT EXISTS kablet_native_checkout_sessions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  cart_version bigint NOT NULL CHECK (cart_version >= 0),
  checkout_revision integer NOT NULL CHECK (checkout_revision > 0),
  fulfillment_type varchar(16) NOT NULL CHECK (fulfillment_type IN ('physical', 'digital')),
  status varchar(32) NOT NULL CHECK (status IN ('created', 'awaiting_confirmation', 'reservation_pending', 'reserved', 'payment_pending', 'payment_unknown', 'failed', 'expired', 'cancelled', 'completed')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  contact_email varchar(320),
  contact_name varchar(200),
  contact_phone varchar(64),
  shipping_address jsonb,
  shipping_eligibility varchar(20) NOT NULL CHECK (shipping_eligibility IN ('not_required', 'pending', 'eligible', 'ineligible', 'unavailable')),
  shipping_charge_state varchar(20) NOT NULL CHECK (shipping_charge_state IN ('not_calculated', 'calculated', 'unavailable')),
  shipping_charge_amount_minor numeric(30, 0),
  shipping_charge_currency varchar(3),
  tax_state varchar(20) NOT NULL CHECK (tax_state IN ('not_calculated', 'calculated', 'unavailable')),
  tax_amount_minor numeric(30, 0),
  tax_currency varchar(3),
  server_total_state varchar(20) NOT NULL CHECK (server_total_state IN ('not_calculated', 'calculated', 'unavailable')),
  server_total_amount_minor numeric(30, 0),
  server_total_currency varchar(3),
  customer_confirmation_revision integer CHECK (customer_confirmation_revision IS NULL OR customer_confirmation_revision > 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, id, cart_id),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  CHECK ((shipping_charge_state = 'calculated' AND shipping_charge_amount_minor IS NOT NULL AND shipping_charge_amount_minor >= 0 AND shipping_charge_currency IS NOT NULL)
      OR (shipping_charge_state <> 'calculated' AND shipping_charge_amount_minor IS NULL AND shipping_charge_currency IS NULL)),
  CHECK ((tax_state = 'calculated' AND tax_amount_minor IS NOT NULL AND tax_amount_minor >= 0 AND tax_currency IS NOT NULL)
      OR (tax_state <> 'calculated' AND tax_amount_minor IS NULL AND tax_currency IS NULL)),
  CHECK ((server_total_state = 'calculated' AND server_total_amount_minor IS NOT NULL AND server_total_amount_minor >= 0 AND server_total_currency IS NOT NULL)
      OR (server_total_state <> 'calculated' AND server_total_amount_minor IS NULL AND server_total_currency IS NULL)),
  CHECK ((shipping_charge_currency IS NULL OR shipping_charge_currency = currency)
      AND (tax_currency IS NULL OR tax_currency = currency)
      AND (server_total_currency IS NULL OR server_total_currency = currency))
);

CREATE TABLE IF NOT EXISTS kablet_native_checkout_lines (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  product_id uuid NOT NULL,
  fulfillment_type varchar(16) NOT NULL CHECK (fulfillment_type IN ('physical', 'digital')),
  sku_snapshot varchar(100) NOT NULL CHECK (sku_snapshot ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_amount_minor numeric(30, 0) NOT NULL CHECK (unit_amount_minor >= 0),
  line_amount_minor numeric(30, 0) NOT NULL CHECK (line_amount_minor >= 0),
  currency_snapshot varchar(3) NOT NULL CHECK (currency_snapshot ~ '^[A-Z]{3}$'),
  price_revision_snapshot integer NOT NULL CHECK (price_revision_snapshot > 0),
  product_title_snapshot varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, checkout_id, id),
  UNIQUE (organization_id, business_id, store_id, checkout_id, product_id),
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, product_id)
    REFERENCES kablet_native_products(organization_id, business_id, store_id, id)
);

CREATE TABLE IF NOT EXISTS kablet_native_inventory_reservations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  checkout_line_id uuid NOT NULL,
  product_id uuid NOT NULL,
  sku_snapshot varchar(100) NOT NULL CHECK (sku_snapshot ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  quantity integer NOT NULL CHECK (quantity > 0),
  status varchar(16) NOT NULL CHECK (status IN ('active', 'committed', 'released', 'expired', 'unknown')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  released_at timestamptz,
  UNIQUE (organization_id, business_id, store_id, checkout_id, checkout_line_id),
  UNIQUE (organization_id, business_id, store_id, checkout_id, product_id),
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id, checkout_line_id)
    REFERENCES kablet_native_checkout_lines(organization_id, business_id, store_id, checkout_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, product_id)
    REFERENCES kablet_native_products(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  CHECK ((status = 'committed' AND committed_at IS NOT NULL AND released_at IS NULL)
      OR (status <> 'committed' AND committed_at IS NULL)),
  CHECK ((status IN ('released', 'expired') AND released_at IS NOT NULL)
      OR (status NOT IN ('released', 'expired') AND released_at IS NULL))
);

CREATE INDEX IF NOT EXISTS kablet_native_checkout_expiry_idx
  ON kablet_native_checkout_sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS kablet_native_checkout_lines_checkout_idx
  ON kablet_native_checkout_lines(organization_id, business_id, store_id, checkout_id);
CREATE INDEX IF NOT EXISTS kablet_native_inventory_reservation_expiry_idx
  ON kablet_native_inventory_reservations(organization_id, business_id, store_id, status, expires_at);
CREATE INDEX IF NOT EXISTS kablet_native_inventory_reservation_product_idx
  ON kablet_native_inventory_reservations(organization_id, business_id, store_id, product_id, status, expires_at);

ALTER TABLE kablet_native_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_checkout_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_checkout_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_checkout_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_inventory_reservations FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_checkout_session_tenant_isolation ON kablet_native_checkout_sessions
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_checkout_line_tenant_isolation ON kablet_native_checkout_lines
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_inventory_reservation_tenant_isolation ON kablet_native_inventory_reservations
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

CREATE OR REPLACE FUNCTION kablet_native_reservation_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id
     OR NEW.business_id <> OLD.business_id
     OR NEW.store_id <> OLD.store_id
     OR NEW.checkout_id <> OLD.checkout_id
     OR NEW.checkout_line_id <> OLD.checkout_line_id
     OR NEW.product_id <> OLD.product_id
     OR NEW.sku_snapshot <> OLD.sku_snapshot
     OR NEW.quantity <> OLD.quantity
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'inventory reservation identity is immutable';
  END IF;
  IF OLD.status IN ('committed', 'released', 'expired') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'terminal inventory reservation cannot transition';
  END IF;
  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'committed', 'released', 'expired', 'unknown') THEN
    RAISE EXCEPTION 'invalid active inventory reservation transition';
  END IF;
  IF OLD.status = 'unknown' AND NEW.status NOT IN ('unknown', 'committed', 'released', 'expired') THEN
    RAISE EXCEPTION 'invalid unknown inventory reservation transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kablet_native_reservation_transition_guard
  BEFORE UPDATE ON kablet_native_inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION kablet_native_reservation_transition_guard();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_native_checkout_sessions, kablet_native_inventory_reservations TO kablet_dev;
    GRANT SELECT, INSERT ON kablet_native_checkout_lines TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_checkout_sessions, kablet_native_checkout_lines, kablet_native_inventory_reservations TO kablet_test_bootstrap;
  END IF;
END $$;
