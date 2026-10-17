-- Durable merchant-controlled checkout policy and explicit fulfillment type.
ALTER TABLE kablet_native_products
  ADD COLUMN IF NOT EXISTS fulfillment_type varchar(16) NOT NULL DEFAULT 'physical'
  CHECK (fulfillment_type IN ('physical','digital'));

CREATE TABLE IF NOT EXISTS kablet_native_checkout_policies (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  status varchar(16) NOT NULL CHECK (status IN ('active','inactive')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  eligible_countries varchar(2)[] NOT NULL CHECK (cardinality(eligible_countries) > 0),
  shipping_amount_minor numeric(30,0) NOT NULL CHECK (shipping_amount_minor >= 0),
  tax_rate_bps integer NOT NULL CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id, revision),
  UNIQUE (organization_id, business_id, store_id, revision),
  FOREIGN KEY (organization_id, business_id, store_id)
    REFERENCES kablet_native_stores(organization_id, business_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_checkout_policy_active_idx
  ON kablet_native_checkout_policies(organization_id, business_id, store_id, currency)
  WHERE status = 'active';

ALTER TABLE kablet_native_checkout_sessions
  ADD COLUMN IF NOT EXISTS shipping_policy_id uuid,
  ADD COLUMN IF NOT EXISTS shipping_policy_revision integer,
  ADD COLUMN IF NOT EXISTS tax_policy_id uuid,
  ADD COLUMN IF NOT EXISTS tax_policy_revision integer;

ALTER TABLE kablet_native_checkout_sessions
  DROP CONSTRAINT IF EXISTS kablet_native_checkout_shipping_policy_fk,
  DROP CONSTRAINT IF EXISTS kablet_native_checkout_tax_policy_fk,
  ADD CONSTRAINT kablet_native_checkout_shipping_policy_fk
    FOREIGN KEY (organization_id, business_id, store_id, shipping_policy_id, shipping_policy_revision)
    REFERENCES kablet_native_checkout_policies(organization_id, business_id, store_id, id, revision),
  ADD CONSTRAINT kablet_native_checkout_tax_policy_fk
    FOREIGN KEY (organization_id, business_id, store_id, tax_policy_id, tax_policy_revision)
    REFERENCES kablet_native_checkout_policies(organization_id, business_id, store_id, id, revision);

ALTER TABLE kablet_native_checkout_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_checkout_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_native_checkout_policy_tenant_isolation ON kablet_native_checkout_policies
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_dev') THEN
    GRANT SELECT ON kablet_native_checkout_policies TO kablet_dev;
    GRANT SELECT ON kablet_native_products TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_checkout_policies TO kablet_test_bootstrap;
    GRANT SELECT, UPDATE ON kablet_native_products TO kablet_test_bootstrap;
  END IF;
END $$;
