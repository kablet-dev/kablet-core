-- Bind platform authorization policies to an authenticated platform session,
-- rather than accepting a caller-supplied actor UUID as proof of identity.
CREATE OR REPLACE FUNCTION kablet_current_actor() RETURNS uuid
LANGUAGE sql STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT s.user_id
  FROM public.kablet_auth_sessions s
  JOIN public.kablet_users u ON u.id = s.user_id
  WHERE s.id = NULLIF(current_setting('kablet.auth_session_id', true), '')::uuid
    AND s.actor_type = 'platform_operator'
    AND s.revoked_at IS NULL
    AND s.expires_at > pg_catalog.now()
    AND u.status = 'active'
$$;

-- The repository lifecycle only changes approval and revocation fields. Keep
-- tenant, requester, purpose, capability scope and expiry immutable at the
-- database privilege boundary as well.
REVOKE UPDATE ON kablet_support_grants FROM kablet_dev, kablet_test_bootstrap;
GRANT UPDATE (approved_by, approved_at, revoked_at) ON kablet_support_grants TO kablet_dev, kablet_test_bootstrap;

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
  IF NEW.approved_by IS NOT NULL AND NEW.approved_at IS NULL THEN
    RAISE EXCEPTION 'approved support grant requires approval timestamp';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS kablet_support_grant_immutable ON kablet_support_grants;
CREATE TRIGGER kablet_support_grant_immutable
BEFORE UPDATE ON kablet_support_grants
FOR EACH ROW EXECUTE FUNCTION kablet_support_grant_immutable();

DROP POLICY IF EXISTS kablet_platform_audit_insert ON kablet_audit_events;
CREATE POLICY kablet_platform_audit_insert ON kablet_audit_events FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    AND business_id IS NULL
    AND actor_type = 'platform_operator'
    AND actor_id = kablet_current_actor()
  );

DROP POLICY IF EXISTS kablet_platform_safety_write ON kablet_platform_safety_rules;
CREATE POLICY kablet_platform_safety_write ON kablet_platform_safety_rules
  FOR INSERT WITH CHECK (
    updated_by = kablet_current_actor()
    AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb)
  );
DROP POLICY IF EXISTS kablet_platform_safety_update ON kablet_platform_safety_rules;
CREATE POLICY kablet_platform_safety_update ON kablet_platform_safety_rules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb)
  ) WITH CHECK (
    updated_by = kablet_current_actor()
    AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["platform.safety.manage"]'::jsonb)
  );
