-- Commerce provider foundation. Provider data is cached evidence; the provider
-- remains authoritative for current price, inventory, orders and payments.
CREATE TABLE IF NOT EXISTS kablet_provider_connections (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('shopify')),
  shop_domain varchar(255) NOT NULL,
  external_shop_id varchar(300),
  credential_provider_key varchar(100) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','reauthorization_required','revoked','disconnected')),
  health_status varchar(32) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('unknown','healthy','degraded','unavailable')),
  last_error varchar(500),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider,shop_domain)
);
CREATE TABLE IF NOT EXISTS kablet_provider_oauth_states (
  state_hash varchar(128) PRIMARY KEY,
  requested_by uuid NOT NULL REFERENCES kablet_users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('shopify')),
  shop_domain varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kablet_catalog_products (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES kablet_provider_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('shopify')),
  external_id varchar(300) NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status varchar(16) NOT NULL CHECK (status IN ('active','draft','archived','unknown')),
  availability varchar(16) NOT NULL CHECK (availability IN ('unknown','available','unavailable','stale')),
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_updated_at timestamptz,
  observed_at timestamptz NOT NULL,
  source_event_occurred_at timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,business_id,provider,external_id)
);

CREATE TABLE IF NOT EXISTS kablet_catalog_variants (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES kablet_catalog_products(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES kablet_provider_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('shopify')),
  external_id varchar(300) NOT NULL,
  title text NOT NULL,
  amount_minor numeric(30,0),
  currency varchar(3),
  available_quantity integer,
  availability varchar(16) NOT NULL CHECK (availability IN ('unknown','available','unavailable','stale')),
  source_updated_at timestamptz,
  observed_at timestamptz NOT NULL,
  source_event_occurred_at timestamptz,
  revision bigint NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((amount_minor IS NULL AND currency IS NULL) OR (amount_minor IS NOT NULL AND currency ~ '^[A-Z]{3}$')),
  UNIQUE (organization_id,business_id,provider,external_id)
);

CREATE TABLE IF NOT EXISTS kablet_catalog_syncs (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES kablet_provider_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  sync_kind varchar(16) NOT NULL CHECK (sync_kind IN ('initial','incremental','reconciliation')),
  status varchar(16) NOT NULL CHECK (status IN ('running','completed','partial','failed','stale')),
  cursor text,
  records_seen integer NOT NULL DEFAULT 0 CHECK (records_seen >= 0),
  records_applied integer NOT NULL DEFAULT 0 CHECK (records_applied >= 0),
  error_message varchar(500),
  source_updated_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS kablet_provider_webhook_inbox (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES kablet_provider_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('shopify')),
  provider_event_id varchar(300) NOT NULL,
  event_type varchar(200) NOT NULL,
  occurred_at timestamptz,
  payload jsonb NOT NULL,
  signature_verified boolean NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','processing','processed','retryable','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(500),
  received_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by varchar(200),
  processed_at timestamptz,
  UNIQUE (organization_id,business_id,provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS kablet_provider_webhook_claim_idx ON kablet_provider_webhook_inbox (status,next_attempt_at,received_at);
CREATE INDEX IF NOT EXISTS kablet_catalog_product_scope_idx ON kablet_catalog_products (organization_id,business_id,updated_at);
CREATE INDEX IF NOT EXISTS kablet_catalog_variant_scope_idx ON kablet_catalog_variants (organization_id,business_id,updated_at);

ALTER TABLE kablet_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_oauth_states FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_products FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_variants FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_catalog_syncs FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_webhook_inbox FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_provider_connection_scope ON kablet_provider_connections USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_control_provider_connection_lookup ON kablet_provider_connections FOR SELECT USING (current_user = 'kablet_control');
CREATE POLICY kablet_provider_oauth_scope ON kablet_provider_oauth_states USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_control_provider_oauth_consume ON kablet_provider_oauth_states FOR UPDATE USING (current_user = 'kablet_control' AND consumed_at IS NULL AND expires_at > now()) WITH CHECK (current_user = 'kablet_control');
CREATE POLICY kablet_catalog_product_scope ON kablet_catalog_products USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_catalog_variant_scope ON kablet_catalog_variants USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_catalog_sync_scope ON kablet_catalog_syncs USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_provider_webhook_scope ON kablet_provider_webhook_inbox USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_control_provider_webhook_insert ON kablet_provider_webhook_inbox FOR INSERT WITH CHECK (current_user = 'kablet_control' AND signature_verified = true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_provider_connections, kablet_catalog_products, kablet_catalog_variants, kablet_catalog_syncs, kablet_provider_webhook_inbox TO kablet_dev;
    GRANT INSERT, UPDATE ON kablet_catalog_products, kablet_catalog_variants, kablet_catalog_syncs, kablet_provider_webhook_inbox TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_provider_credentials TO kablet_control;
    GRANT SELECT, INSERT, UPDATE ON kablet_provider_connections TO kablet_control;
    GRANT SELECT, INSERT, UPDATE ON kablet_provider_oauth_states TO kablet_control;
    GRANT INSERT ON kablet_provider_webhook_inbox TO kablet_control;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON kablet_provider_connections, kablet_provider_oauth_states, kablet_catalog_products, kablet_catalog_variants, kablet_catalog_syncs, kablet_provider_webhook_inbox TO kablet_test_bootstrap;
  END IF;
END
$$;
