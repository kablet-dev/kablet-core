ALTER TABLE kablet_auth_sessions DROP CONSTRAINT IF EXISTS kablet_auth_sessions_actor_type_check;
ALTER TABLE kablet_auth_sessions ADD CONSTRAINT kablet_auth_sessions_actor_type_check CHECK (actor_type IN ('merchant_user','platform_operator'));

CREATE TABLE IF NOT EXISTS kablet_platform_operators (
  user_id uuid PRIMARY KEY REFERENCES kablet_users(id),
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  capabilities jsonb NOT NULL DEFAULT '["audit.read"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kablet_policy_approval_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  policy_key varchar(160) NOT NULL,
  revision_id uuid NOT NULL,
  event_type varchar(32) NOT NULL CHECK (event_type IN ('requested','approved','rejected')),
  actor_id uuid NOT NULL REFERENCES kablet_users(id),
  actor_type varchar(32) NOT NULL CHECK (actor_type IN ('merchant_user','platform_operator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kablet_policy_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_policy_approval_events FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_policy_approval_event_isolation ON kablet_policy_approval_events
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

REVOKE ALL ON kablet_platform_operators FROM PUBLIC;
REVOKE ALL ON kablet_policy_approval_events FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_dev') THEN
    GRANT SELECT ON kablet_platform_operators TO kablet_dev;
    GRANT SELECT, INSERT ON kablet_policy_approval_events TO kablet_dev;
    REVOKE UPDATE, DELETE ON kablet_policy_approval_events FROM kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kablet_test_bootstrap') THEN
    GRANT SELECT, INSERT ON kablet_platform_operators, kablet_policy_approval_events TO kablet_test_bootstrap;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION kablet_audit_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'kablet_privacy_owner' THEN
    RAISE EXCEPTION 'audit events are append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS kablet_audit_events_immutable ON kablet_audit_events;
CREATE TRIGGER kablet_audit_events_immutable BEFORE UPDATE OR DELETE ON kablet_audit_events FOR EACH ROW EXECUTE FUNCTION kablet_audit_events_immutable();
REVOKE UPDATE, DELETE ON kablet_audit_events FROM kablet_dev;
