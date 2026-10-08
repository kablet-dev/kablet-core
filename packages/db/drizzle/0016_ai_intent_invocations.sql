CREATE TABLE IF NOT EXISTS ai_intent_accounting_periods (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  period_kind varchar(8) NOT NULL CHECK (period_kind IN ('daily','monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end > period_start),
  max_units bigint NOT NULL CHECK (max_units >= 0),
  reserved_units bigint NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  consumed_units bigint NOT NULL DEFAULT 0 CHECK (consumed_units >= 0),
  uncertain_units bigint NOT NULL DEFAULT 0 CHECK (uncertain_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,business_id,period_kind,period_start),
  UNIQUE (organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id) REFERENCES businesses(organization_id,id)
);

CREATE TABLE IF NOT EXISTS ai_intent_invocations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  visitor_identity_id uuid,
  visitor_session_id uuid,
  interaction_session_id uuid,
  idempotency_key varchar(200) NOT NULL,
  input_fingerprint bytea,
  status varchar(16) NOT NULL CHECK (status IN ('claimed','succeeded','failed','unknown')),
  interpreter_version varchar(64) NOT NULL,
  provider_key varchar(64),
  provider_request_reference varchar(200),
  normalized_intent varchar(32) CHECK (normalized_intent IN ('explore_offerings','request_information','select_offering','unclear')),
  reason_code varchar(32) CHECK (reason_code IN ('intent_extracted','ambiguous','unsupported_request','safety_filtered')),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  reserved_units bigint NOT NULL CHECK (reserved_units >= 0),
  consumed_units bigint NOT NULL DEFAULT 0 CHECK (consumed_units >= 0),
  released_units bigint NOT NULL DEFAULT 0 CHECK (released_units >= 0),
  uncertain_units bigint NOT NULL DEFAULT 0 CHECK (uncertain_units >= 0),
  daily_period_id uuid NOT NULL,
  monthly_period_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id,business_id,interaction_session_id,idempotency_key),
  FOREIGN KEY (organization_id,business_id) REFERENCES businesses(organization_id,id),
  FOREIGN KEY (organization_id,business_id,visitor_identity_id) REFERENCES visitor_identities(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,visitor_session_id) REFERENCES visitor_sessions(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,interaction_session_id) REFERENCES interaction_sessions(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,daily_period_id) REFERENCES ai_intent_accounting_periods(organization_id,business_id,id),
  FOREIGN KEY (organization_id,business_id,monthly_period_id) REFERENCES ai_intent_accounting_periods(organization_id,business_id,id),
  CHECK (consumed_units + released_units + uncertain_units <= reserved_units),
  CHECK ((status='succeeded' AND normalized_intent IS NOT NULL AND reason_code IS NOT NULL) OR status<>'succeeded')
);

ALTER TABLE ai_intent_accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_intent_accounting_periods FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_intent_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_intent_invocations FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_intent_accounting_period_isolation ON ai_intent_accounting_periods USING (organization_id=kablet_current_org() AND business_id=kablet_current_business()) WITH CHECK (organization_id=kablet_current_org() AND business_id=kablet_current_business());
CREATE POLICY ai_intent_invocation_isolation ON ai_intent_invocations USING (organization_id=kablet_current_org() AND business_id=kablet_current_business()) WITH CHECK (organization_id=kablet_current_org() AND business_id=kablet_current_business());

SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_ai_period_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI accounting period history is immutable';
  END IF;
  IF OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.business_id IS DISTINCT FROM NEW.business_id OR OLD.period_kind IS DISTINCT FROM NEW.period_kind OR OLD.period_start IS DISTINCT FROM NEW.period_start OR OLD.period_end IS DISTINCT FROM NEW.period_end OR OLD.max_units IS DISTINCT FROM NEW.max_units OR OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'AI accounting period identity is immutable';
  END IF;
  RETURN NEW;
END $$;
RESET ROLE;
CREATE TRIGGER ai_intent_accounting_periods_immutable BEFORE UPDATE OR DELETE ON ai_intent_accounting_periods FOR EACH ROW EXECUTE FUNCTION kablet_ai_period_immutable();

SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_ai_invocation_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AI invocation history is immutable';
  END IF;
  IF OLD.visitor_identity_id IS DISTINCT FROM NEW.visitor_identity_id OR OLD.visitor_session_id IS DISTINCT FROM NEW.visitor_session_id OR OLD.interaction_session_id IS DISTINCT FROM NEW.interaction_session_id OR OLD.input_fingerprint IS DISTINCT FROM NEW.input_fingerprint THEN
    IF NOT EXISTS (SELECT 1 FROM public.kablet_privacy_operations p WHERE p.transaction_id=pg_catalog.txid_current() AND p.organization_id=OLD.organization_id AND p.visitor_identity_id=OLD.visitor_identity_id)
       OR NEW.visitor_identity_id IS NOT NULL OR NEW.visitor_session_id IS NOT NULL OR NEW.interaction_session_id IS NOT NULL OR NEW.input_fingerprint IS NOT NULL THEN
      RAISE EXCEPTION 'AI invocation visitor identity is immutable';
    END IF;
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.business_id IS DISTINCT FROM NEW.business_id OR OLD.interaction_session_id IS DISTINCT FROM NEW.interaction_session_id OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR OLD.input_fingerprint IS DISTINCT FROM NEW.input_fingerprint OR OLD.daily_period_id IS DISTINCT FROM NEW.daily_period_id OR OLD.monthly_period_id IS DISTINCT FROM NEW.monthly_period_id OR NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN
    IF NOT EXISTS (SELECT 1 FROM public.kablet_privacy_operations p WHERE p.transaction_id=pg_catalog.txid_current() AND p.organization_id=OLD.organization_id AND p.visitor_identity_id=OLD.visitor_identity_id)
       OR NEW.visitor_identity_id IS NOT NULL OR NEW.visitor_session_id IS NOT NULL OR NEW.interaction_session_id IS NOT NULL OR NEW.input_fingerprint IS NOT NULL
       OR OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.business_id IS DISTINCT FROM NEW.business_id OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key OR OLD.daily_period_id IS DISTINCT FROM NEW.daily_period_id OR OLD.monthly_period_id IS DISTINCT FROM NEW.monthly_period_id OR NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN
      RAISE EXCEPTION 'AI invocation identity is immutable';
    END IF;
  END IF;
  IF OLD.status IN ('succeeded','failed','unknown') AND (
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.interpreter_version IS DISTINCT FROM OLD.interpreter_version OR
    NEW.provider_key IS DISTINCT FROM OLD.provider_key OR
    NEW.provider_request_reference IS DISTINCT FROM OLD.provider_request_reference OR
    NEW.normalized_intent IS DISTINCT FROM OLD.normalized_intent OR
    NEW.reason_code IS DISTINCT FROM OLD.reason_code OR
    NEW.confidence IS DISTINCT FROM OLD.confidence OR
    NEW.reserved_units IS DISTINCT FROM OLD.reserved_units OR
    NEW.consumed_units IS DISTINCT FROM OLD.consumed_units OR
    NEW.released_units IS DISTINCT FROM OLD.released_units OR
    NEW.uncertain_units IS DISTINCT FROM OLD.uncertain_units OR
    NEW.daily_period_id IS DISTINCT FROM OLD.daily_period_id OR
    NEW.monthly_period_id IS DISTINCT FROM OLD.monthly_period_id OR
    NEW.claimed_at IS DISTINCT FROM OLD.claimed_at OR
    NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN RAISE EXCEPTION 'completed AI invocation accounting is immutable'; END IF;
  IF OLD.status='claimed' AND NEW.status NOT IN ('claimed','succeeded','failed','unknown') THEN RAISE EXCEPTION 'invalid AI invocation transition'; END IF;
  RETURN NEW;
END $$;
RESET ROLE;
CREATE TRIGGER ai_intent_invocations_transition BEFORE UPDATE OR DELETE ON ai_intent_invocations FOR EACH ROW EXECUTE FUNCTION kablet_ai_invocation_transition();

SET LOCAL ROLE kablet_privacy_owner;
REVOKE ALL ON FUNCTION kablet_ai_period_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION kablet_ai_invocation_transition() FROM PUBLIC;
RESET ROLE;

GRANT SELECT,INSERT,UPDATE ON ai_intent_accounting_periods,ai_intent_invocations TO kablet_dev;
GRANT SELECT ON ai_intent_accounting_periods,ai_intent_invocations TO kablet_privacy_owner;
GRANT UPDATE (visitor_identity_id,visitor_session_id,interaction_session_id,input_fingerprint) ON ai_intent_invocations TO kablet_privacy_owner;

SET LOCAL ROLE kablet_privacy_owner;
CREATE OR REPLACE FUNCTION kablet_visitor_privacy_delete(p_organization_id uuid, p_visitor_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE deleted boolean;
BEGIN
  IF p_organization_id <> public.kablet_current_org() THEN RAISE EXCEPTION 'privacy tenant mismatch'; END IF;
  INSERT INTO public.kablet_privacy_operations(transaction_id,organization_id,visitor_identity_id) VALUES (pg_catalog.txid_current(),p_organization_id,p_visitor_id);
  UPDATE public.ai_intent_invocations SET visitor_identity_id=NULL, visitor_session_id=NULL, interaction_session_id=NULL, input_fingerprint=NULL WHERE organization_id=p_organization_id AND visitor_identity_id=p_visitor_id;
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
REVOKE ALL ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) FROM kablet_test_manager;
GRANT EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid,uuid) TO kablet_dev;
ALTER FUNCTION kablet_visitor_privacy_delete(uuid,uuid) OWNER TO kablet_privacy_owner;
RESET ROLE;
