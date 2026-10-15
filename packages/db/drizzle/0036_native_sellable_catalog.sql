-- Native one-variant sellable catalog foundation.
-- Existing products receive a stable legacy SKU and remain quantity-unconfigured
-- until an authorized stock operation supplies an explicit quantity.
ALTER TABLE kablet_native_products
  ADD COLUMN IF NOT EXISTS sku varchar(100);

UPDATE kablet_native_products
SET sku = 'legacy-' || replace(id::text, '-', '')
WHERE sku IS NULL;

ALTER TABLE kablet_native_products
  ALTER COLUMN sku SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_products_store_sku_idx
  ON kablet_native_products(store_id, sku);

ALTER TABLE kablet_native_products
  ADD COLUMN IF NOT EXISTS inventory_quantity integer,
  ADD COLUMN IF NOT EXISTS price_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS inventory_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE kablet_native_products
  ADD CONSTRAINT kablet_native_products_inventory_nonnegative
  CHECK (inventory_quantity IS NULL OR inventory_quantity >= 0);

ALTER TABLE kablet_native_products
  ADD CONSTRAINT kablet_native_products_price_revision_positive
  CHECK (price_revision > 0);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_products TO kablet_dev;
    GRANT UPDATE (inventory_quantity, availability, inventory_updated_at, updated_at) ON kablet_native_products TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_native_products TO kablet_test_bootstrap;
  END IF;
END $$;
