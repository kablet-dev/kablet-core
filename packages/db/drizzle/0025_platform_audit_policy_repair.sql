DROP POLICY IF EXISTS kablet_platform_audit_insert ON kablet_audit_events;
CREATE POLICY kablet_platform_audit_insert ON kablet_audit_events FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    AND business_id IS NULL
    AND actor_type = 'platform_operator'
    AND actor_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = actor_id AND p.status = 'active')
  );

CREATE POLICY kablet_platform_audit_read ON kablet_audit_events FOR SELECT
  USING (
    organization_id IS NULL
    AND business_id IS NULL
    AND actor_type = 'platform_operator'
    AND EXISTS (SELECT 1 FROM kablet_platform_operators p WHERE p.user_id = kablet_current_actor() AND p.status = 'active' AND p.capabilities @> '["audit.read"]'::jsonb)
  );
