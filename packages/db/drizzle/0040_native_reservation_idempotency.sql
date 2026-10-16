-- Durable idempotency records for confirmed reservation attempts.
-- The request key is stored only as a SHA-256 hash; runtime operations are
-- still tenant-scoped and do not decrement inventory.

CREATE TABLE IF NOT EXISTS kablet_native_reservation_mutations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  idempotency_key_hash bytea NOT NULL,
  request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  checkout_revision integer NOT NULL CHECK (checkout_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, cart_id, idempotency_key_hash),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id, cart_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id, cart_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS kablet_native_reservation_mutations_checkout_idx
  ON kablet_native_reservation_mutations(organization_id, business_id, store_id, cart_id, created_at);

ALTER TABLE kablet_native_reservation_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_reservation_mutations FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_reservation_mutation_tenant_isolation ON kablet_native_reservation_mutations
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT ON kablet_native_reservation_mutations TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_reservation_mutations TO kablet_test_bootstrap;
  END IF;
END $$;
