ALTER TABLE visitor_state_revisions ADD CONSTRAINT visitor_state_revision_scope UNIQUE (organization_id, business_id, visitor_identity_id, id);
CREATE TABLE IF NOT EXISTS visitor_decisions (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL, business_id uuid NOT NULL, visitor_identity_id uuid NOT NULL,
  session_id uuid NOT NULL, decision_type text NOT NULL CHECK (decision_type IN ('clarify_intent','present_offering','request_time_window','offer_next_step','no_safe_decision')),
  status text NOT NULL CHECK (status = 'accepted'), contract_version text NOT NULL, policy_id text NOT NULL, policy_version text NOT NULL,
  visitor_state_revision_id uuid NOT NULL, visitor_state_version bigint NOT NULL CHECK (visitor_state_version >= 0),
  idempotency_key text NOT NULL, input_fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, visitor_identity_id, idempotency_key),
  FOREIGN KEY (organization_id,business_id,visitor_identity_id) REFERENCES visitor_identities(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,session_id) REFERENCES visitor_sessions(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,visitor_identity_id,visitor_state_revision_id) REFERENCES visitor_state_revisions(organization_id,business_id,visitor_identity_id,id)
);
ALTER TABLE visitor_decisions ADD CONSTRAINT visitor_decisions_scope UNIQUE (organization_id, business_id, id);
CREATE TABLE IF NOT EXISTS visitor_decision_business_truth_refs (
  decision_id uuid NOT NULL, organization_id uuid NOT NULL, business_id uuid NOT NULL, offering_id uuid NOT NULL, offering_revision_id uuid NOT NULL,
  PRIMARY KEY (decision_id, offering_id, offering_revision_id),
  FOREIGN KEY (decision_id) REFERENCES visitor_decisions(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, decision_id) REFERENCES visitor_decisions(organization_id, business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, offering_id) REFERENCES business_offerings(business_id,id),
  FOREIGN KEY (offering_id, offering_revision_id) REFERENCES business_offering_revisions(offering_id,id)
);
ALTER TABLE visitor_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE visitor_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE visitor_decision_business_truth_refs ENABLE ROW LEVEL SECURITY; ALTER TABLE visitor_decision_business_truth_refs FORCE ROW LEVEL SECURITY;
CREATE POLICY visitor_decision_isolation ON visitor_decisions USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY visitor_decision_ref_isolation ON visitor_decision_business_truth_refs USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE OR REPLACE FUNCTION kablet_decision_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.kablet_privacy_operations WHERE transaction_id=pg_catalog.txid_current() AND organization_id=OLD.organization_id AND visitor_identity_id=OLD.visitor_identity_id) THEN RAISE EXCEPTION 'accepted decisions are immutable'; END IF; RETURN OLD; END $$;
CREATE TRIGGER visitor_decisions_immutable BEFORE UPDATE OR DELETE ON visitor_decisions FOR EACH ROW EXECUTE FUNCTION kablet_decision_immutable();
REVOKE ALL ON FUNCTION kablet_decision_immutable() FROM PUBLIC; ALTER FUNCTION kablet_decision_immutable() OWNER TO kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_decision_ref_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.kablet_privacy_operations p JOIN public.visitor_decisions d ON d.organization_id=p.organization_id AND d.visitor_identity_id=p.visitor_identity_id WHERE p.transaction_id=pg_catalog.txid_current() AND d.id=OLD.decision_id) THEN RAISE EXCEPTION 'accepted decisions are immutable'; END IF; RETURN OLD; END $$;
CREATE TRIGGER visitor_decision_refs_immutable BEFORE UPDATE OR DELETE ON visitor_decision_business_truth_refs FOR EACH ROW EXECUTE FUNCTION kablet_decision_ref_immutable();
REVOKE ALL ON FUNCTION kablet_decision_ref_immutable() FROM PUBLIC; ALTER FUNCTION kablet_decision_ref_immutable() OWNER TO kablet_privacy_owner;
GRANT SELECT, INSERT ON visitor_decisions, visitor_decision_business_truth_refs TO kablet_dev;
GRANT SELECT, DELETE ON visitor_decisions, visitor_decision_business_truth_refs TO kablet_privacy_owner;
SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_visitor_privacy_delete(p_organization_id uuid, p_visitor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$ DECLARE deleted boolean; BEGIN IF p_organization_id <> public.kablet_current_org() THEN RAISE EXCEPTION 'privacy tenant mismatch'; END IF; INSERT INTO public.kablet_privacy_operations(transaction_id,organization_id,visitor_identity_id) VALUES (pg_catalog.txid_current(),p_organization_id,p_visitor_id); DELETE FROM public.visitor_decision_business_truth_refs r USING public.visitor_decisions d WHERE d.id = r.decision_id AND d.organization_id = p_organization_id AND d.visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_decisions WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_states WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_observations WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_state_revisions WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_sessions WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id; DELETE FROM public.visitor_identities WHERE organization_id = p_organization_id AND id = p_visitor_id RETURNING true INTO deleted; DELETE FROM public.kablet_privacy_operations WHERE transaction_id=pg_catalog.txid_current() AND organization_id=p_organization_id AND visitor_identity_id=p_visitor_id; RETURN COALESCE(deleted,false); END $$;
REVOKE ALL ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) FROM PUBLIC; REVOKE EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) FROM kablet_test_manager; GRANT EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) TO kablet_dev; ALTER FUNCTION kablet_visitor_privacy_delete(uuid,uuid) OWNER TO kablet_privacy_owner;
RESET ROLE;
