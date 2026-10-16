-- Durable idempotency for anonymous cart bootstrap requests.
-- Bearer tokens remain hash-only; aliases allow a concurrent retry to receive
-- a fresh token without invalidating the first response's token.

CREATE TABLE IF NOT EXISTS kablet_native_cart_tokens (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kablet_native_cart_creations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  idempotency_key_hash bytea NOT NULL,
  cart_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, idempotency_key_hash),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE CASCADE
);

CREATE INDEX kablet_native_cart_creations_expiry_idx
  ON kablet_native_cart_creations(expires_at);
CREATE INDEX kablet_native_cart_tokens_expiry_idx
  ON kablet_native_cart_tokens(expires_at);

ALTER TABLE kablet_native_cart_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_creations FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_cart_token_tenant_isolation ON kablet_native_cart_tokens
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_cart_creation_tenant_isolation ON kablet_native_cart_creations
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_cart_tokens, kablet_native_cart_creations TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_cart_tokens, kablet_native_cart_creations TO kablet_test_bootstrap;
  END IF;
END $$;
