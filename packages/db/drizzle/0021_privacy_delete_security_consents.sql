SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_visitor_privacy_delete(p_organization_id uuid, p_visitor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE deleted boolean;
BEGIN
  IF p_organization_id <> public.kablet_current_org() THEN RAISE EXCEPTION 'privacy tenant mismatch'; END IF;
  INSERT INTO public.kablet_privacy_operations(transaction_id,organization_id,visitor_identity_id) VALUES (pg_catalog.txid_current(),p_organization_id,p_visitor_id);
  UPDATE public.ai_intent_invocations a
  SET visitor_identity_id=NULL, visitor_session_id=NULL, interaction_session_id=NULL, input_fingerprint=NULL
  WHERE a.organization_id=p_organization_id
    AND (
      a.visitor_identity_id=p_visitor_id
      OR EXISTS (SELECT 1 FROM public.visitor_sessions s WHERE s.organization_id=a.organization_id AND s.business_id=a.business_id AND s.id=a.visitor_session_id AND s.visitor_identity_id=p_visitor_id)
      OR EXISTS (SELECT 1 FROM public.interaction_sessions i WHERE i.organization_id=a.organization_id AND i.business_id=a.business_id AND i.id=a.interaction_session_id AND i.visitor_identity_id=p_visitor_id)
    );
  DELETE FROM public.conversion_facts WHERE organization_id=p_organization_id AND outcome_id IN (SELECT o.id FROM public.action_outcomes o JOIN public.action_requests ar ON ar.id=o.action_request_id AND ar.organization_id=o.organization_id AND ar.business_id=o.business_id WHERE o.organization_id=p_organization_id AND ar.visitor_identity_id=p_visitor_id);
  DELETE FROM public.outcome_attributions WHERE organization_id=p_organization_id AND acquisition_context_id IN (SELECT id FROM public.acquisition_contexts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id);
  DELETE FROM public.interaction_facts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.experience_exposures WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.acquisition_contexts WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.action_outcomes WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.execution_attempts WHERE organization_id=p_organization_id AND action_request_id IN (SELECT id FROM public.action_requests WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id);
  DELETE FROM public.action_requests WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_decision_business_truth_refs r USING public.visitor_decisions d WHERE d.id=r.decision_id AND d.organization_id=p_organization_id AND d.visitor_identity_id=p_visitor_id;
  DELETE FROM public.visitor_decisions WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
  DELETE FROM public.kablet_consents WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
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
ALTER FUNCTION kablet_visitor_privacy_delete(uuid,uuid) OWNER TO kablet_privacy_owner;
RESET ROLE;
