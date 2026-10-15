CREATE TABLE IF NOT EXISTS kablet_native_stores (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  public_slug varchar(100) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  brand_mark varchar(120),
  primary_currency varchar(3) NOT NULL CHECK (primary_currency ~ '^[A-Z]{3}$'),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id)
);

CREATE TABLE IF NOT EXISTS kablet_native_products (
  id uuid PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES kablet_native_stores(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  public_slug varchar(100) NOT NULL,
  title varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  amount_minor numeric(30, 0) NOT NULL CHECK (amount_minor >= 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  availability varchar(20) NOT NULL DEFAULT 'unknown' CHECK (availability IN ('unknown', 'available', 'unavailable', 'stale')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, public_slug)
);

CREATE INDEX kablet_native_stores_public_slug_idx ON kablet_native_stores(public_slug);
CREATE INDEX kablet_native_products_store_status_idx ON kablet_native_products(store_id, status);

ALTER TABLE kablet_native_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_stores FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_products FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_store_public_read ON kablet_native_stores
  FOR SELECT USING (status = 'published');
CREATE POLICY kablet_native_product_public_read ON kablet_native_products
  FOR SELECT USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM kablet_native_stores s
      WHERE s.id = store_id AND s.status = 'published'
    )
  );
CREATE POLICY kablet_native_store_tenant_write ON kablet_native_stores
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_product_tenant_write ON kablet_native_products
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT USAGE ON SCHEMA public TO kablet_dev;
    GRANT SELECT ON kablet_native_stores, kablet_native_products TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_stores, kablet_native_products TO kablet_test_bootstrap;
  END IF;
END $$;
