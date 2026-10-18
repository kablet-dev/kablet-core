-- Versioned, merchant-approved deterministic native composition rules.

CREATE TABLE IF NOT EXISTS kablet_native_rules (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  rule_key varchar(80) NOT NULL CHECK (rule_key ~ '^[a-z0-9._-]+$'),
  version integer NOT NULL CHECK (version > 0),
  status varchar(16) NOT NULL CHECK (status IN ('draft','validated','approved','active','disabled','rolled_back')),
  priority integer NOT NULL CHECK (priority >= 0 AND priority <= 100000),
  conditions jsonb NOT NULL CHECK (jsonb_typeof(conditions) = 'object'),
  composition varchar(32) NOT NULL CHECK (composition IN ('entry','discovery','comparison')),
  reason_code varchar(64) NOT NULL CHECK (reason_code IN ('baseline_safe_default','explicit_intent','merchant_truth_match','missing_authoritative_truth','unavailable_composition')),
  reason varchar(240) NOT NULL,
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, rule_key, version),
  FOREIGN KEY (organization_id, business_id, store_id) REFERENCES kablet_native_stores(organization_id, business_id, id),
  FOREIGN KEY (organization_id, business_id) REFERENCES businesses(organization_id, id),
  CHECK ((status IN ('approved','active') AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR status NOT IN ('approved','active'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_one_active_rule_key
  ON kablet_native_rules (organization_id, business_id, store_id, rule_key)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.kablet_native_rule_immutable_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.organization_id <> OLD.organization_id OR NEW.business_id <> OLD.business_id
     OR NEW.store_id <> OLD.store_id OR NEW.rule_key <> OLD.rule_key OR NEW.version <> OLD.version
     OR NEW.priority <> OLD.priority OR NEW.conditions <> OLD.conditions OR NEW.composition <> OLD.composition
     OR NEW.reason_code <> OLD.reason_code OR NEW.reason <> OLD.reason THEN
    RAISE EXCEPTION 'native rule definition is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS kablet_native_rule_immutable_fields ON kablet_native_rules;
CREATE TRIGGER kablet_native_rule_immutable_fields
  BEFORE UPDATE ON kablet_native_rules FOR EACH ROW EXECUTE FUNCTION public.kablet_native_rule_immutable_fields();

ALTER TABLE visitor_decisions
  ADD COLUMN IF NOT EXISTS native_store_id uuid,
  ADD COLUMN IF NOT EXISTS native_rule_id uuid,
  ADD COLUMN IF NOT EXISTS native_rule_version integer,
  ADD COLUMN IF NOT EXISTS native_rule_reason_code varchar(64),
  ADD COLUMN IF NOT EXISTS native_rule_reason varchar(240);
ALTER TABLE visitor_decisions
  ADD CONSTRAINT visitor_decisions_native_rule_fk
  FOREIGN KEY (organization_id, business_id, native_store_id, native_rule_id)
  REFERENCES kablet_native_rules(organization_id, business_id, store_id, id);

ALTER TABLE kablet_native_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_native_rules_tenant_isolation ON kablet_native_rules
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_rules TO kablet_dev;
    GRANT INSERT (native_store_id, native_rule_id, native_rule_version, native_rule_reason_code, native_rule_reason) ON visitor_decisions TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_native_rules TO kablet_control;
  END IF;
END $$;
