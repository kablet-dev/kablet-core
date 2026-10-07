CREATE TABLE IF NOT EXISTS business_intent_policy_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  policy_key varchar(64) NOT NULL CHECK (policy_key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,business_id,id),
  UNIQUE (organization_id,business_id,policy_key,id),
  UNIQUE (organization_id,business_id,policy_key,revision_number),
  FOREIGN KEY (organization_id,business_id) REFERENCES businesses(organization_id,id)
);
CREATE TABLE IF NOT EXISTS business_intent_policy_requirements (
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  policy_revision_id uuid NOT NULL,
  requirement_key varchar(64) NOT NULL CHECK (requirement_key ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  prompt varchar(300) NOT NULL,
  options jsonb NOT NULL,
  PRIMARY KEY (organization_id,business_id,policy_revision_id,requirement_key),
  FOREIGN KEY (organization_id,business_id,policy_revision_id) REFERENCES business_intent_policy_revisions(organization_id,business_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS business_intent_policy_rules (
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  policy_revision_id uuid NOT NULL,
  intent varchar(32) NOT NULL CHECK (intent IN ('explore_offerings','request_information','select_offering')),
  PRIMARY KEY (organization_id,business_id,policy_revision_id,intent),
  FOREIGN KEY (organization_id,business_id,policy_revision_id) REFERENCES business_intent_policy_revisions(organization_id,business_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS business_intent_policy_rule_requirements (
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  policy_revision_id uuid NOT NULL,
  intent varchar(32) NOT NULL,
  requirement_key varchar(64) NOT NULL,
  PRIMARY KEY (organization_id,business_id,policy_revision_id,intent,requirement_key),
  FOREIGN KEY (organization_id,business_id,policy_revision_id,intent) REFERENCES business_intent_policy_rules(organization_id,business_id,policy_revision_id,intent) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,business_id,policy_revision_id,requirement_key) REFERENCES business_intent_policy_requirements(organization_id,business_id,policy_revision_id,requirement_key) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS business_intent_policy_publications (
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  policy_key varchar(64) NOT NULL,
  revision_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,business_id,policy_key),
  UNIQUE (organization_id,business_id,policy_key,revision_id),
  FOREIGN KEY (organization_id,business_id,policy_key,revision_id) REFERENCES business_intent_policy_revisions(organization_id,business_id,policy_key,id) ON DELETE RESTRICT
);
ALTER TABLE visitor_decisions ADD COLUMN IF NOT EXISTS intent_policy_revision_id uuid;
ALTER TABLE visitor_decisions ADD CONSTRAINT visitor_decisions_intent_policy_revision_fk FOREIGN KEY (organization_id,business_id,intent_policy_revision_id) REFERENCES business_intent_policy_revisions(organization_id,business_id,id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['business_intent_policy_revisions','business_intent_policy_requirements','business_intent_policy_rules','business_intent_policy_rule_requirements','business_intent_policy_publications'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t); EXECUTE format('CREATE POLICY %I ON %I USING (organization_id = kablet_current_org() AND business_id = kablet_current_business()) WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business())',t||'_isolation',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION kablet_intent_policy_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'business intent policy revisions are immutable'; END $$;
CREATE TRIGGER business_intent_policy_revisions_immutable BEFORE UPDATE OR DELETE ON business_intent_policy_revisions FOR EACH ROW EXECUTE FUNCTION kablet_intent_policy_immutable();
CREATE TRIGGER business_intent_policy_requirements_immutable BEFORE UPDATE OR DELETE ON business_intent_policy_requirements FOR EACH ROW EXECUTE FUNCTION kablet_intent_policy_immutable();
CREATE TRIGGER business_intent_policy_rules_immutable BEFORE UPDATE OR DELETE ON business_intent_policy_rules FOR EACH ROW EXECUTE FUNCTION kablet_intent_policy_immutable();
CREATE TRIGGER business_intent_policy_rule_requirements_immutable BEFORE UPDATE OR DELETE ON business_intent_policy_rule_requirements FOR EACH ROW EXECUTE FUNCTION kablet_intent_policy_immutable();
GRANT SELECT,INSERT ON business_intent_policy_revisions,business_intent_policy_requirements,business_intent_policy_rules,business_intent_policy_rule_requirements TO kablet_dev;
GRANT SELECT,INSERT,UPDATE ON business_intent_policy_publications TO kablet_dev;
GRANT SELECT,DELETE ON business_intent_policy_revisions,business_intent_policy_requirements,business_intent_policy_rules,business_intent_policy_rule_requirements,business_intent_policy_publications TO kablet_privacy_owner;
GRANT SELECT ON business_intent_policy_revisions,business_intent_policy_requirements,business_intent_policy_rules,business_intent_policy_rule_requirements,business_intent_policy_publications TO kablet_dev;
