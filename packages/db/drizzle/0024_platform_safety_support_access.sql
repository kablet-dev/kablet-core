CREATE OR REPLACE FUNCTION kablet_current_actor() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('kablet.actor_id', true), '')::uuid $$;

CREATE TABLE IF NOT EXISTS kablet_support_grants (
  id uuid PRIMARY KEY,
  requested_by uuid NOT NULL REFERENCES kablet_users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  purpose varchar(500) NOT NULL CHECK (length(btrim(purpose)) >= 10),
  capabilities jsonb NOT NULL CHECK (jsonb_typeof(capabilities) = 'array' AND jsonb_array_length(capabilities) > 0 AND capabilities <@ '["truth.read","credential.read_metadata","privacy.manage","audit.read"]'::jsonb),
  expires_at timestamptz NOT NULL,
  approved_by uuid NULL REFERENCES kablet_users(id),
  approved_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

ALTER TABLE kablet_support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_support_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_support_grant_read ON kablet_support_grants FOR SELECT
  USING (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["support.grant"]'::jsonb));
CREATE POLICY kablet_support_grant_insert ON kablet_support_grants FOR INSERT
  WITH CHECK (requested_by = kablet_current_actor() AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["support.grant"]'::jsonb));
CREATE POLICY kablet_support_grant_update ON kablet_support_grants FOR UPDATE
  USING (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["support.grant"]'::jsonb))
  WITH CHECK (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["support.grant"]'::jsonb));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_dev') THEN GRANT SELECT, INSERT, UPDATE ON kablet_support_grants TO kablet_dev; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_test_bootstrap') THEN GRANT SELECT, INSERT, UPDATE ON kablet_support_grants TO kablet_test_bootstrap; END IF;
END $$;

CREATE TABLE IF NOT EXISTS kablet_platform_safety_rules (
  rule_key varchar(160) PRIMARY KEY,
  effect varchar(16) NOT NULL CHECK (effect IN ('allow', 'deny')),
  reason varchar(500) NOT NULL CHECK (length(btrim(reason)) >= 10),
  updated_by uuid NULL REFERENCES kablet_users(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kablet_platform_safety_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_platform_safety_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_platform_safety_read ON kablet_platform_safety_rules FOR SELECT USING (true);
CREATE POLICY kablet_platform_safety_write ON kablet_platform_safety_rules
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb));
CREATE POLICY kablet_platform_safety_update ON kablet_platform_safety_rules
  FOR UPDATE USING (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb))
  WITH CHECK (EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_dev') THEN GRANT SELECT, INSERT, UPDATE ON kablet_platform_safety_rules TO kablet_dev; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_test_bootstrap') THEN GRANT SELECT ON kablet_platform_safety_rules TO kablet_test_bootstrap; END IF;
END $$;

ALTER TABLE kablet_platform_safety_rules NO FORCE ROW LEVEL SECURITY;
INSERT INTO kablet_platform_safety_rules(rule_key,effect,reason,updated_by)
VALUES ('*','allow','Default platform safety baseline',NULL)
ON CONFLICT (rule_key) DO NOTHING;
ALTER TABLE kablet_platform_safety_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_platform_audit_insert ON kablet_audit_events FOR INSERT
  WITH CHECK (organization_id IS NULL AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active'));
