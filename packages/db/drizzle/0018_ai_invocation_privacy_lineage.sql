SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_ai_invocation_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE privacy_authorized boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.kablet_privacy_operations p
    WHERE p.transaction_id=pg_catalog.txid_current()
      AND p.organization_id=OLD.organization_id
      AND (
        p.visitor_identity_id=OLD.visitor_identity_id
        OR EXISTS (SELECT 1 FROM public.visitor_sessions s WHERE s.organization_id=OLD.organization_id AND s.business_id=OLD.business_id AND s.id=OLD.visitor_session_id AND s.visitor_identity_id=p.visitor_identity_id)
        OR EXISTS (SELECT 1 FROM public.interaction_sessions i WHERE i.organization_id=OLD.organization_id AND i.business_id=OLD.business_id AND i.id=OLD.interaction_session_id AND i.visitor_identity_id=p.visitor_identity_id)
      )
  ) INTO privacy_authorized;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI invocation history is immutable';
  END IF;
  IF OLD.visitor_identity_id IS DISTINCT FROM NEW.visitor_identity_id OR OLD.visitor_session_id IS DISTINCT FROM NEW.visitor_session_id OR OLD.interaction_session_id IS DISTINCT FROM NEW.interaction_session_id OR OLD.input_fingerprint IS DISTINCT FROM NEW.input_fingerprint THEN
    IF NOT privacy_authorized OR NEW.visitor_identity_id IS NOT NULL OR NEW.visitor_session_id IS NOT NULL OR NEW.interaction_session_id IS NOT NULL OR NEW.input_fingerprint IS NOT NULL THEN
      RAISE EXCEPTION 'AI invocation visitor identity is immutable';
    END IF;
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.business_id IS DISTINCT FROM NEW.business_id OR OLD.interaction_session_id IS DISTINCT FROM NEW.interaction_session_id OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR OLD.input_fingerprint IS DISTINCT FROM NEW.input_fingerprint OR OLD.daily_period_id IS DISTINCT FROM NEW.daily_period_id OR OLD.monthly_period_id IS DISTINCT FROM NEW.monthly_period_id OR NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN
    IF NOT privacy_authorized OR NEW.visitor_identity_id IS NOT NULL OR NEW.visitor_session_id IS NOT NULL OR NEW.interaction_session_id IS NOT NULL OR NEW.input_fingerprint IS NOT NULL
       OR OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.business_id IS DISTINCT FROM NEW.business_id OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR OLD.daily_period_id IS DISTINCT FROM NEW.daily_period_id OR OLD.monthly_period_id IS DISTINCT FROM NEW.monthly_period_id OR NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN
      RAISE EXCEPTION 'AI invocation identity is immutable';
    END IF;
  END IF;
  IF OLD.status IN ('succeeded','failed','unknown') AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.interpreter_version IS DISTINCT FROM OLD.interpreter_version OR NEW.provider_key IS DISTINCT FROM OLD.provider_key OR NEW.provider_request_reference IS DISTINCT FROM OLD.provider_request_reference OR NEW.normalized_intent IS DISTINCT FROM OLD.normalized_intent OR NEW.reason_code IS DISTINCT FROM OLD.reason_code OR NEW.confidence IS DISTINCT FROM OLD.confidence OR NEW.reserved_units IS DISTINCT FROM OLD.reserved_units OR NEW.consumed_units IS DISTINCT FROM OLD.consumed_units OR NEW.released_units IS DISTINCT FROM OLD.released_units OR NEW.uncertain_units IS DISTINCT FROM OLD.uncertain_units OR NEW.daily_period_id IS DISTINCT FROM OLD.daily_period_id OR NEW.monthly_period_id IS DISTINCT FROM OLD.monthly_period_id OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN RAISE EXCEPTION 'completed AI invocation accounting is immutable'; END IF;
  IF OLD.status='claimed' AND NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN RAISE EXCEPTION 'invalid AI invocation transition'; END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION kablet_ai_invocation_transition() OWNER TO kablet_privacy_owner;
RESET ROLE;

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
