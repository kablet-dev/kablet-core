-- Native persistent cart contracts only. Cart runtime operations are implemented
-- later and must use an opaque, hashed browser token plus tenant context.

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_stores_tenant_id_idx
  ON kablet_native_stores(organization_id, business_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_products_tenant_store_id_idx
  ON kablet_native_products(organization_id, business_id, store_id, id);

CREATE TABLE IF NOT EXISTS kablet_native_carts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, id),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, id, currency),
  FOREIGN KEY (organization_id, business_id, store_id)
    REFERENCES kablet_native_stores(organization_id, business_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kablet_native_cart_lines (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  sku_snapshot varchar(100) NOT NULL CHECK (sku_snapshot ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  amount_minor_snapshot numeric(30, 0) NOT NULL CHECK (amount_minor_snapshot >= 0),
  currency_snapshot varchar(3) NOT NULL CHECK (currency_snapshot ~ '^[A-Z]{3}$'),
  price_revision_snapshot integer NOT NULL CHECK (price_revision_snapshot > 0),
  accepted_amount_minor numeric(30, 0),
  accepted_currency varchar(3),
  accepted_price_revision integer,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id),
  UNIQUE (organization_id, business_id, cart_id, id),
  CHECK ((accepted_amount_minor IS NULL AND accepted_currency IS NULL AND accepted_price_revision IS NULL AND accepted_at IS NULL)
      OR (accepted_amount_minor IS NOT NULL AND accepted_amount_minor >= 0 AND accepted_currency IS NOT NULL
          AND accepted_currency ~ '^[A-Z]{3}$' AND accepted_price_revision IS NOT NULL AND accepted_price_revision > 0
          AND accepted_at IS NOT NULL)),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id, currency_snapshot)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id, currency)
    ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, product_id)
    REFERENCES kablet_native_products(organization_id, business_id, store_id, id)
);

CREATE TABLE IF NOT EXISTS kablet_native_cart_mutations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  operation varchar(20) NOT NULL CHECK (operation IN ('add_line', 'update_line', 'remove_line', 'accept_price')),
  idempotency_key varchar(200) NOT NULL,
  request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  result_cart_version bigint CHECK (result_cart_version IS NULL OR result_cart_version >= 0),
  result_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, cart_id, idempotency_key),
  FOREIGN KEY (organization_id, business_id, store_id, cart_id)
    REFERENCES kablet_native_carts(organization_id, business_id, store_id, id)
    ON DELETE CASCADE
);

CREATE INDEX kablet_native_carts_expiry_idx
  ON kablet_native_carts(status, expires_at);
CREATE INDEX kablet_native_cart_lines_cart_idx
  ON kablet_native_cart_lines(organization_id, business_id, cart_id);
CREATE INDEX kablet_native_cart_mutations_cart_idx
  ON kablet_native_cart_mutations(organization_id, business_id, cart_id, created_at);

ALTER TABLE kablet_native_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_carts FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_cart_mutations FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_cart_tenant_isolation ON kablet_native_carts
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_cart_line_tenant_isolation ON kablet_native_cart_lines
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_cart_mutation_tenant_isolation ON kablet_native_cart_mutations
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_carts, kablet_native_cart_lines, kablet_native_cart_mutations TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_carts, kablet_native_cart_lines, kablet_native_cart_mutations TO kablet_test_bootstrap;
  END IF;
END $$;
