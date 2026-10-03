CREATE TABLE IF NOT EXISTS interaction_sessions (
  id uuid PRIMARY KEY,
  handle_hash bytea NOT NULL UNIQUE,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  visitor_identity_id uuid NOT NULL,
  visitor_session_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (organization_id, business_id, id),
  FOREIGN KEY (organization_id, business_id, visitor_identity_id) REFERENCES visitor_identities(organization_id, business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, visitor_session_id) REFERENCES visitor_sessions(organization_id, business_id, id) ON DELETE CASCADE
);
ALTER TABLE interaction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interaction_session_isolation ON interaction_sessions;
CREATE POLICY interaction_session_isolation ON interaction_sessions USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
GRANT SELECT, INSERT, UPDATE ON interaction_sessions TO kablet_dev;
