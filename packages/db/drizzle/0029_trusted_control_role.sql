-- Platform authorization must execute through a server-only database role.
-- The ordinary runtime role may not mint or mutate platform sessions.
CREATE OR REPLACE FUNCTION kablet_current_actor() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT s.user_id
  FROM public.kablet_auth_sessions s
  JOIN public.kablet_users u ON u.id = s.user_id
  WHERE pg_catalog.current_user = 'kablet_control'
    AND s.id = NULLIF(current_setting('kablet.auth_session_id', true), '')::uuid
    AND s.actor_type = 'platform_operator'
    AND s.revoked_at IS NULL
    AND s.expires_at > pg_catalog.now()
    AND u.status = 'active'
$$;

CREATE OR REPLACE FUNCTION kablet_auth_session_actor_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.actor_type = 'platform_operator' AND pg_catalog.current_user <> 'kablet_control' THEN
    RAISE EXCEPTION 'platform sessions require the control database role';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS kablet_auth_session_actor_guard ON kablet_auth_sessions;
CREATE TRIGGER kablet_auth_session_actor_guard
BEFORE INSERT OR UPDATE OF actor_type ON kablet_auth_sessions
FOR EACH ROW EXECUTE FUNCTION kablet_auth_session_actor_guard();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    REVOKE INSERT ON kablet_auth_sessions FROM kablet_dev;
    REVOKE UPDATE ON kablet_auth_sessions FROM kablet_dev;
    GRANT UPDATE (revoked_at) ON kablet_auth_sessions TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_test_bootstrap') THEN
    REVOKE INSERT ON kablet_auth_sessions FROM kablet_test_bootstrap;
    REVOKE UPDATE ON kablet_auth_sessions FROM kablet_test_bootstrap;
    GRANT UPDATE (revoked_at) ON kablet_auth_sessions TO kablet_test_bootstrap;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION kablet_support_grant_immutable() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.purpose IS DISTINCT FROM OLD.purpose
    OR NEW.capabilities IS DISTINCT FROM OLD.capabilities
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR (OLD.approved_by IS NOT NULL AND NEW.approved_by IS DISTINCT FROM OLD.approved_by)
    OR (OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at)
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
  THEN
    RAISE EXCEPTION 'support grant immutable fields cannot change';
  END IF;
  IF OLD.approved_by IS NULL AND NEW.approved_by IS NOT NULL THEN
    IF NEW.approved_by IS DISTINCT FROM public.kablet_current_actor() THEN
      RAISE EXCEPTION 'support grant approver identity mismatch';
    END IF;
    IF OLD.revoked_at IS NOT NULL OR OLD.expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'support grant unavailable';
    END IF;
    NEW.approved_at := pg_catalog.clock_timestamp();
  ELSIF NEW.approved_by IS NULL AND NEW.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'support grant approval transition invalid';
  END IF;
  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT USAGE ON SCHEMA public TO kablet_control;
    GRANT SELECT, INSERT, UPDATE ON kablet_users TO kablet_control;
    GRANT SELECT, INSERT, UPDATE (revoked_at) ON kablet_auth_sessions TO kablet_control;
    GRANT SELECT ON kablet_platform_operators, kablet_memberships TO kablet_control;
    GRANT SELECT, INSERT, UPDATE (approved_by, approved_at, revoked_at) ON kablet_support_grants TO kablet_control;
    GRANT SELECT, INSERT, UPDATE ON kablet_platform_safety_rules TO kablet_control;
    GRANT SELECT, INSERT ON kablet_audit_events TO kablet_control;
    GRANT SELECT ON organizations, businesses TO kablet_control;
    GRANT EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid, uuid) TO kablet_control;
  END IF;
END
$$;
