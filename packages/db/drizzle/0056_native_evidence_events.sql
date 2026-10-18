-- Bounded, privacy-safe native session evidence. This records lineage and
-- structured facts only; it never authorizes commerce or claims a purchase.
CREATE TABLE IF NOT EXISTS native_evidence_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  visitor_identity_id uuid NOT NULL,
  visitor_session_id uuid NOT NULL,
  interaction_session_id uuid NOT NULL,
  visitor_state_revision_id uuid,
  decision_id uuid,
  exposure_id uuid,
  rule_key varchar(160),
  rule_version integer CHECK (rule_version IS NULL OR rule_version > 0),
  decision_reason varchar(1000),
  event_kind varchar(40) NOT NULL CHECK (event_kind IN ('session_started','session_returned','intent_submitted','preference_changed','product_impression','product_viewed','comparison_selected','clarification_selected','cart_added','cart_removed','checkout_started','checkout_failed','decision_exposed','ai_interpretation','verified_purchase')),
  occurred_at timestamptz NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,business_id,id),
  UNIQUE (organization_id,business_id,interaction_session_id,event_kind,idempotency_key),
  FOREIGN KEY (organization_id,business_id,store_id) REFERENCES kablet_native_stores(organization_id,business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,business_id,visitor_identity_id) REFERENCES visitor_identities(organization_id,business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,business_id,visitor_session_id) REFERENCES visitor_sessions(organization_id,business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,business_id,interaction_session_id) REFERENCES interaction_sessions(organization_id,business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,business_id,visitor_state_revision_id) REFERENCES visitor_state_revisions(organization_id,business_id,id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id,business_id,decision_id) REFERENCES visitor_decisions(organization_id,business_id,id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id,business_id,exposure_id) REFERENCES experience_exposures(organization_id,business_id,id) ON DELETE SET NULL,
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX native_evidence_session_idx ON native_evidence_events (organization_id,business_id,visitor_session_id,occurred_at,id);
CREATE INDEX native_evidence_store_idx ON native_evidence_events (organization_id,business_id,store_id,occurred_at,id);
ALTER TABLE native_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE native_evidence_events FORCE ROW LEVEL SECURITY;
CREATE POLICY native_evidence_tenant_isolation ON native_evidence_events
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

CREATE OR REPLACE FUNCTION kablet_native_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'native evidence events are immutable'; END;
$$;
CREATE TRIGGER native_evidence_immutable_trigger BEFORE UPDATE OR DELETE ON native_evidence_events
  FOR EACH ROW EXECUTE FUNCTION kablet_native_evidence_immutable();
REVOKE ALL ON FUNCTION kablet_native_evidence_immutable() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT ON native_evidence_events TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT ON native_evidence_events TO kablet_control;
  END IF;
END $$;
