DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_privacy_owner') THEN
    RAISE EXCEPTION 'required role kablet_privacy_owner is missing; provision it as a NOLOGIN role before migration';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT pg_has_role(current_user, 'kablet_privacy_owner', 'SET') THEN
    RAISE EXCEPTION 'migration role must be able to SET ROLE kablet_privacy_owner for ownership transfer; ordinary migration roles are insufficient';
  END IF;
  IF NOT has_schema_privilege('kablet_privacy_owner', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'kablet_privacy_owner requires CREATE on schema public for owned security objects';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION kablet_current_business() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('kablet.business_id', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS kablet_privacy_operations (
  transaction_id bigint NOT NULL,
  organization_id uuid NOT NULL,
  visitor_identity_id uuid NOT NULL,
  PRIMARY KEY (transaction_id, organization_id, visitor_identity_id)
);
REVOKE ALL ON kablet_privacy_operations FROM PUBLIC;
ALTER TABLE kablet_privacy_operations OWNER TO kablet_privacy_owner;

CREATE OR REPLACE FUNCTION kablet_visitor_privacy_delete(p_organization_id uuid, p_visitor_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE deleted boolean;
BEGIN
  IF p_organization_id <> public.kablet_current_org() THEN RAISE EXCEPTION 'privacy tenant mismatch'; END IF;
  INSERT INTO public.kablet_privacy_operations VALUES (txid_current(), p_organization_id, p_visitor_id);
  DELETE FROM public.visitor_states WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id;
  DELETE FROM public.visitor_observations WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id;
  DELETE FROM public.visitor_state_revisions WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id;
  DELETE FROM public.visitor_sessions WHERE organization_id = p_organization_id AND visitor_identity_id = p_visitor_id;
  DELETE FROM public.visitor_identities WHERE organization_id = p_organization_id AND id = p_visitor_id RETURNING true INTO deleted;
  DELETE FROM public.kablet_privacy_operations WHERE transaction_id = txid_current() AND organization_id = p_organization_id AND visitor_identity_id = p_visitor_id;
  RETURN COALESCE(deleted, false);
END $$;
REVOKE ALL ON FUNCTION kablet_visitor_privacy_delete(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid, uuid) FROM kablet_test_manager;
GRANT EXECUTE ON FUNCTION kablet_visitor_privacy_delete(uuid, uuid) TO kablet_dev;
GRANT USAGE ON SCHEMA public TO kablet_privacy_owner;
GRANT SELECT, DELETE ON visitor_states, visitor_observations, visitor_state_revisions, visitor_sessions, visitor_identities TO kablet_privacy_owner;
ALTER FUNCTION kablet_visitor_privacy_delete(uuid, uuid) OWNER TO kablet_privacy_owner;

CREATE OR REPLACE FUNCTION kablet_visitor_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.kablet_privacy_operations
    WHERE transaction_id = pg_catalog.txid_current()
      AND organization_id = OLD.organization_id
      AND visitor_identity_id = OLD.visitor_identity_id
  ) THEN
    RAISE EXCEPTION 'visitor history is immutable';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION kablet_visitor_immutable() FROM PUBLIC;
ALTER FUNCTION kablet_visitor_immutable() OWNER TO kablet_privacy_owner;

DROP POLICY IF EXISTS visitor_identity_isolation ON visitor_identities;
CREATE POLICY visitor_identity_isolation ON visitor_identities USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
DROP POLICY IF EXISTS visitor_session_isolation ON visitor_sessions;
CREATE POLICY visitor_session_isolation ON visitor_sessions USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
DROP POLICY IF EXISTS visitor_observation_isolation ON visitor_observations;
CREATE POLICY visitor_observation_isolation ON visitor_observations USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
DROP POLICY IF EXISTS visitor_revision_isolation ON visitor_state_revisions;
CREATE POLICY visitor_revision_isolation ON visitor_state_revisions USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
DROP POLICY IF EXISTS visitor_state_isolation ON visitor_states;
CREATE POLICY visitor_state_isolation ON visitor_states USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
