CREATE TABLE IF NOT EXISTS kablet_users (
  id uuid PRIMARY KEY,
  auth_provider varchar(64) NOT NULL,
  provider_subject varchar(300) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS kablet_memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES kablet_users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NULL REFERENCES businesses(id),
  role varchar(32) NOT NULL CHECK (role IN ('owner','admin','operator','analyst','support')),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kablet_auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES kablet_users(id),
  token_hash bytea NOT NULL UNIQUE,
  actor_type varchar(32) NOT NULL CHECK (actor_type = 'merchant_user'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kablet_provider_credentials (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  provider_key varchar(100) NOT NULL,
  encrypted_secret bytea NOT NULL,
  key_version varchar(64) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by uuid NOT NULL REFERENCES kablet_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  UNIQUE (organization_id, business_id, provider_key)
);

CREATE TABLE IF NOT EXISTS kablet_consents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  visitor_identity_id uuid NOT NULL,
  purpose varchar(64) NOT NULL CHECK (purpose IN ('contact','personalization','intelligence_context','analytics')),
  version varchar(64) NOT NULL,
  granted_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, visitor_identity_id, purpose, version)
);

CREATE TABLE IF NOT EXISTS kablet_audit_events (
  id uuid PRIMARY KEY,
  organization_id uuid NULL REFERENCES organizations(id),
  business_id uuid NULL REFERENCES businesses(id),
  actor_id uuid NULL,
  actor_type varchar(32) NOT NULL CHECK (actor_type IN ('merchant_user','platform_operator','system','visitor','integration')),
  action varchar(160) NOT NULL,
  resource_type varchar(100) NOT NULL,
  resource_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kablet_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE kablet_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_provider_credentials ENABLE ROW LEVEL SECURITY; ALTER TABLE kablet_provider_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_consents ENABLE ROW LEVEL SECURITY; ALTER TABLE kablet_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE kablet_audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_membership_isolation ON kablet_memberships USING (organization_id = kablet_current_org() AND (business_id IS NULL OR business_id = kablet_current_business()));
CREATE POLICY kablet_credentials_isolation ON kablet_provider_credentials USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_consent_isolation ON kablet_consents USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_audit_isolation ON kablet_audit_events USING (organization_id IS NOT NULL AND organization_id = kablet_current_org() AND (business_id IS NULL OR business_id = kablet_current_business())) WITH CHECK (organization_id IS NOT NULL AND organization_id = kablet_current_org() AND (business_id IS NULL OR business_id = kablet_current_business()));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_dev') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_users, kablet_memberships, kablet_auth_sessions, kablet_provider_credentials, kablet_consents, kablet_audit_events TO kablet_dev;
    GRANT DELETE ON kablet_consents TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_users, kablet_memberships, kablet_auth_sessions, kablet_provider_credentials, kablet_consents, kablet_audit_events TO kablet_test_bootstrap;
  END IF;
END $$;
