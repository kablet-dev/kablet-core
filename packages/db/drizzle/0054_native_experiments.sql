-- Deterministic, merchant-approved native storefront experiments.
-- Assignment is server-authorized; this migration does not expose creation or
-- activation through the visitor runtime.

ALTER TABLE visitor_decisions
  ADD COLUMN IF NOT EXISTS native_experiment_id uuid,
  ADD COLUMN IF NOT EXISTS native_experiment_assignment_id uuid;

CREATE TABLE IF NOT EXISTS kablet_native_experiments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  experiment_key varchar(80) NOT NULL CHECK (experiment_key ~ '^[a-z0-9._-]+$'),
  version integer NOT NULL CHECK (version > 0),
  state varchar(16) NOT NULL CHECK (state IN ('draft','approved','active','paused','ended')),
  eligibility jsonb NOT NULL CHECK (jsonb_typeof(eligibility) = 'object'),
  control_composition varchar(32) NOT NULL CHECK (control_composition IN ('entry','discovery','comparison')),
  treatment_composition varchar(32) NOT NULL CHECK (treatment_composition IN ('entry','discovery','comparison')),
  control_allocation_bps integer NOT NULL CHECK (control_allocation_bps >= 0 AND control_allocation_bps <= 10000),
  treatment_allocation_bps integer NOT NULL CHECK (treatment_allocation_bps >= 0 AND treatment_allocation_bps <= 10000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  attribution_window_days integer NOT NULL CHECK (attribution_window_days > 0 AND attribution_window_days <= 365),
  attribution_rule varchar(64) NOT NULL CHECK (attribution_rule = 'last_native_exposure.v1'),
  primary_metric jsonb NOT NULL CHECK (jsonb_typeof(primary_metric) = 'object'),
  guardrail_metrics jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(guardrail_metrics) = 'array'),
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, id),
  UNIQUE (organization_id, business_id, store_id, experiment_key, version),
  CHECK (control_allocation_bps + treatment_allocation_bps = 10000),
  CHECK (control_composition <> treatment_composition),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK ((state = 'active' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR state <> 'active'),
  FOREIGN KEY (organization_id, business_id, store_id) REFERENCES kablet_native_stores(organization_id, business_id, id),
  FOREIGN KEY (organization_id, business_id) REFERENCES businesses(organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS kablet_native_one_active_experiment_per_store
  ON kablet_native_experiments (organization_id, business_id, store_id)
  WHERE state = 'active';

CREATE OR REPLACE FUNCTION public.kablet_lock_native_experiment_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.organization_id::text || ':' || NEW.business_id::text || ':' || NEW.store_id::text || ':' || NEW.id::text,
    0
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kablet_native_experiment_governance_lock ON kablet_native_experiments;
CREATE TRIGGER kablet_native_experiment_governance_lock
  BEFORE UPDATE OF state, starts_at, ends_at ON kablet_native_experiments
  FOR EACH ROW EXECUTE FUNCTION public.kablet_lock_native_experiment_governance();

CREATE TABLE IF NOT EXISTS kablet_native_experiment_assignments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  experiment_id uuid NOT NULL,
  visitor_identity_id uuid NOT NULL,
  arm varchar(16) NOT NULL CHECK (arm IN ('control','treatment')),
  hash_version varchar(32) NOT NULL CHECK (hash_version = 'sha256-bucket.v1'),
  bucket integer NOT NULL CHECK (bucket >= 0 AND bucket < 10000),
  status varchar(16) NOT NULL CHECK (status IN ('eligible','ineligible')),
  exclusion_reason varchar(120),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, id),
  UNIQUE (organization_id, business_id, store_id, experiment_id, visitor_identity_id),
  FOREIGN KEY (organization_id, business_id, store_id, experiment_id) REFERENCES kablet_native_experiments(organization_id, business_id, store_id, id),
  FOREIGN KEY (organization_id, business_id, visitor_identity_id) REFERENCES visitor_identities(organization_id, business_id, id)
);

CREATE TABLE IF NOT EXISTS kablet_native_experiment_exposures (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  experiment_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  decision_id uuid NOT NULL,
  exposure_id uuid NOT NULL,
  arm varchar(16) NOT NULL CHECK (arm IN ('control','treatment')),
  composition_id varchar(32) NOT NULL CHECK (composition_id IN ('entry','discovery','comparison')),
  status varchar(16) NOT NULL CHECK (status IN ('exposed','fallback','noncompliant')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, assignment_id, exposure_id),
  FOREIGN KEY (organization_id, business_id, store_id, experiment_id) REFERENCES kablet_native_experiments(organization_id, business_id, store_id, id),
  FOREIGN KEY (organization_id, business_id, store_id, assignment_id) REFERENCES kablet_native_experiment_assignments(organization_id, business_id, store_id, id),
  FOREIGN KEY (organization_id, business_id, decision_id) REFERENCES visitor_decisions(organization_id, business_id, id),
  FOREIGN KEY (organization_id, business_id, exposure_id) REFERENCES experience_exposures(organization_id, business_id, id)
);

ALTER TABLE kablet_native_experiment_assignments
  ADD CONSTRAINT kablet_native_assignment_experiment_arm_uk
  UNIQUE (organization_id, business_id, store_id, id, experiment_id, arm);

ALTER TABLE kablet_native_experiment_exposures
  ADD CONSTRAINT kablet_native_exposure_assignment_arm_fk
  FOREIGN KEY (organization_id, business_id, store_id, assignment_id, experiment_id, arm)
  REFERENCES kablet_native_experiment_assignments(organization_id, business_id, store_id, id, experiment_id, arm);

CREATE OR REPLACE FUNCTION public.kablet_validate_native_experiment_exposure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  expected_composition varchar(32);
BEGIN
  SELECT CASE WHEN a.arm = 'control' THEN e.control_composition ELSE e.treatment_composition END
    INTO expected_composition
    FROM public.kablet_native_experiment_assignments a
    JOIN public.kablet_native_experiments e
      ON e.organization_id = a.organization_id
     AND e.business_id = a.business_id
     AND e.store_id = a.store_id
     AND e.id = a.experiment_id
   WHERE a.organization_id = NEW.organization_id
     AND a.business_id = NEW.business_id
     AND a.store_id = NEW.store_id
     AND a.id = NEW.assignment_id
     AND a.experiment_id = NEW.experiment_id
     AND a.arm = NEW.arm;

  IF expected_composition IS NULL OR expected_composition <> NEW.composition_id THEN
    RAISE EXCEPTION 'native experiment exposure composition conflict';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.visitor_decisions d
      JOIN public.experience_exposures x
        ON x.organization_id = d.organization_id
       AND x.business_id = d.business_id
       AND x.id = NEW.exposure_id
       AND x.decision_id = d.id
       AND x.composition_id = NEW.composition_id
     WHERE d.organization_id = NEW.organization_id
       AND d.business_id = NEW.business_id
       AND d.id = NEW.decision_id
       AND d.native_experiment_id = NEW.experiment_id
       AND d.native_experiment_assignment_id = NEW.assignment_id
  ) THEN
    RAISE EXCEPTION 'native experiment exposure lineage conflict';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kablet_native_exposure_integrity ON kablet_native_experiment_exposures;
CREATE TRIGGER kablet_native_exposure_integrity
  BEFORE INSERT OR UPDATE ON kablet_native_experiment_exposures
  FOR EACH ROW EXECUTE FUNCTION public.kablet_validate_native_experiment_exposure();

ALTER TABLE visitor_decisions
  ADD CONSTRAINT visitor_decisions_native_experiment_fk
  FOREIGN KEY (organization_id, business_id, native_experiment_id)
  REFERENCES kablet_native_experiments(organization_id, business_id, id);
ALTER TABLE visitor_decisions
  ADD CONSTRAINT visitor_decisions_native_assignment_fk
  FOREIGN KEY (organization_id, business_id, native_experiment_assignment_id)
  REFERENCES kablet_native_experiment_assignments(organization_id, business_id, id);

ALTER TABLE kablet_native_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_experiments FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_experiment_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_experiment_exposures ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_experiment_exposures FORCE ROW LEVEL SECURITY;

CREATE POLICY kablet_native_experiment_tenant_isolation ON kablet_native_experiments
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_assignment_tenant_isolation ON kablet_native_experiment_assignments
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());
CREATE POLICY kablet_native_exposure_tenant_isolation ON kablet_native_experiment_exposures
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT ON kablet_native_experiments TO kablet_dev;
    GRANT SELECT, INSERT ON kablet_native_experiment_assignments, kablet_native_experiment_exposures TO kablet_dev;
    GRANT INSERT (native_experiment_id, native_experiment_assignment_id) ON visitor_decisions TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT ON kablet_native_experiments, kablet_native_experiment_assignments, kablet_native_experiment_exposures TO kablet_control;
  END IF;
END $$;
