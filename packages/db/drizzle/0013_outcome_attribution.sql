CREATE UNIQUE INDEX IF NOT EXISTS action_outcomes_tenant_id_key ON action_outcomes (organization_id,business_id,id);
CREATE TABLE IF NOT EXISTS outcome_attributions (id uuid PRIMARY KEY, organization_id uuid NOT NULL, business_id uuid NOT NULL, outcome_id uuid NOT NULL, acquisition_context_id uuid NOT NULL, interaction_session_id uuid NOT NULL, rule varchar(64) NOT NULL CHECK (rule='same_interaction_acquisition.v1'), attributed_at timestamptz NOT NULL, UNIQUE (organization_id,business_id,id), UNIQUE (organization_id,business_id,outcome_id), FOREIGN KEY (organization_id,business_id,outcome_id) REFERENCES action_outcomes(organization_id,business_id,id) ON DELETE CASCADE, FOREIGN KEY (organization_id,business_id,acquisition_context_id) REFERENCES acquisition_contexts(organization_id,business_id,id) ON DELETE CASCADE, FOREIGN KEY (organization_id,business_id,interaction_session_id) REFERENCES interaction_sessions(organization_id,business_id,id) ON DELETE CASCADE);
ALTER TABLE outcome_attributions ENABLE ROW LEVEL SECURITY; ALTER TABLE outcome_attributions FORCE ROW LEVEL SECURITY;
CREATE POLICY outcome_attribution_isolation ON outcome_attributions USING (organization_id=kablet_current_org() AND business_id=kablet_current_business()) WITH CHECK (organization_id=kablet_current_org() AND business_id=kablet_current_business());
GRANT SELECT, INSERT ON outcome_attributions TO kablet_dev;
GRANT SELECT, DELETE ON outcome_attributions TO kablet_privacy_owner;
CREATE INDEX outcome_attributions_acquisition_idx ON outcome_attributions (organization_id,business_id,acquisition_context_id);
SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_attribution_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' AND current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='kablet_visitor_privacy_delete(uuid,uuid)'::regprocedure)) AND EXISTS (
    SELECT 1
    FROM public.acquisition_contexts ac
    JOIN public.kablet_privacy_operations po
      ON po.transaction_id=pg_catalog.txid_current()
     AND po.organization_id=OLD.organization_id
     AND po.visitor_identity_id=ac.visitor_identity_id
    WHERE ac.organization_id=OLD.organization_id
      AND ac.business_id=OLD.business_id
      AND ac.id=OLD.acquisition_context_id
  ) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'outcome attribution is immutable';
END $$;
GRANT EXECUTE ON FUNCTION kablet_attribution_immutable() TO kablet_test_bootstrap;
RESET ROLE;
CREATE TRIGGER outcome_attributions_immutable BEFORE UPDATE OR DELETE ON outcome_attributions FOR EACH ROW EXECUTE FUNCTION kablet_attribution_immutable();
SET LOCAL ROLE kablet_privacy_owner;
REVOKE EXECUTE ON FUNCTION kablet_attribution_immutable() FROM PUBLIC, kablet_test_bootstrap;
RESET ROLE;
SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_visitor_privacy_delete(p_organization_id uuid, p_visitor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE deleted boolean;
BEGIN
  IF p_organization_id <> public.kablet_current_org() THEN RAISE EXCEPTION 'privacy tenant mismatch'; END IF;
  INSERT INTO public.kablet_privacy_operations(transaction_id,organization_id,visitor_identity_id) VALUES (pg_catalog.txid_current(),p_organization_id,p_visitor_id);
  DELETE FROM public.outcome_attributions WHERE organization_id=p_organization_id AND acquisition_context_id IN (SELECT id FROM public.acquisition_contexts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id);
  DELETE FROM public.interaction_facts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.experience_exposures WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.acquisition_contexts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.action_outcomes WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.execution_attempts WHERE organization_id=p_organization_id AND action_request_id IN (SELECT id FROM public.action_requests WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id);
  DELETE FROM public.action_requests WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_decision_business_truth_refs r USING public.visitor_decisions d WHERE d.id=r.decision_id AND d.organization_id=p_organization_id AND d.visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_decisions WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_consents WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_contact_records WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.interaction_sessions WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_states WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_observations WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_state_revisions WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_sessions WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_identities WHERE organization_id=p_organization_id AND id=p_visitor_id RETURNING true INTO deleted;
  DELETE FROM public.kablet_privacy_operations WHERE transaction_id=pg_catalog.txid_current() AND organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  RETURN COALESCE(deleted,false);
END $$;
RESET ROLE;
