-- Trusted native-intelligence attribution snapshot.
-- Attribution is observational lineage only and never authorizes commerce.

ALTER TABLE kablet_native_checkout_sessions
  ADD COLUMN IF NOT EXISTS native_visitor_identity_id uuid,
  ADD COLUMN IF NOT EXISTS native_visitor_session_id uuid,
  ADD COLUMN IF NOT EXISTS native_interaction_session_id uuid,
  ADD COLUMN IF NOT EXISTS native_decision_id uuid,
  ADD COLUMN IF NOT EXISTS native_exposure_id uuid,
  ADD COLUMN IF NOT EXISTS native_composition_id varchar(80),
  ADD COLUMN IF NOT EXISTS native_composition_version varchar(40);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kablet_checkout_native_visitor_fk') THEN
    ALTER TABLE kablet_native_checkout_sessions ADD CONSTRAINT kablet_checkout_native_visitor_fk
      FOREIGN KEY (organization_id, business_id, native_visitor_identity_id)
      REFERENCES visitor_identities(organization_id, business_id, id) ON DELETE SET NULL (native_visitor_identity_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kablet_checkout_native_session_fk') THEN
    ALTER TABLE kablet_native_checkout_sessions ADD CONSTRAINT kablet_checkout_native_session_fk
      FOREIGN KEY (organization_id, business_id, native_visitor_session_id)
      REFERENCES visitor_sessions(organization_id, business_id, id) ON DELETE SET NULL (native_visitor_session_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kablet_checkout_native_interaction_fk') THEN
    ALTER TABLE kablet_native_checkout_sessions ADD CONSTRAINT kablet_checkout_native_interaction_fk
      FOREIGN KEY (organization_id, business_id, native_interaction_session_id)
      REFERENCES interaction_sessions(organization_id, business_id, id) ON DELETE SET NULL (native_interaction_session_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kablet_checkout_native_decision_fk') THEN
    ALTER TABLE kablet_native_checkout_sessions ADD CONSTRAINT kablet_checkout_native_decision_fk
      FOREIGN KEY (organization_id, business_id, native_decision_id)
      REFERENCES visitor_decisions(organization_id, business_id, id) ON DELETE SET NULL (native_decision_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kablet_checkout_native_exposure_fk') THEN
    ALTER TABLE kablet_native_checkout_sessions ADD CONSTRAINT kablet_checkout_native_exposure_fk
      FOREIGN KEY (organization_id, business_id, native_exposure_id)
      REFERENCES experience_exposures(organization_id, business_id, id) ON DELETE SET NULL (native_exposure_id);
  END IF;
END $$;

ALTER TABLE kablet_native_checkout_sessions
  ADD CONSTRAINT kablet_checkout_native_lineage_shape_check CHECK (
    native_exposure_id IS NULL OR (
      native_visitor_identity_id IS NOT NULL AND native_visitor_session_id IS NOT NULL
      AND native_interaction_session_id IS NOT NULL AND native_decision_id IS NOT NULL
      AND native_composition_id IS NOT NULL AND native_composition_version IS NOT NULL
    )
  );

CREATE TABLE IF NOT EXISTS kablet_native_order_attributions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_id uuid NOT NULL,
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  checkout_id uuid NOT NULL,
  visitor_identity_id uuid,
  visitor_session_id uuid,
  interaction_session_id uuid,
  decision_id uuid,
  exposure_id uuid,
  composition_id varchar(80),
  composition_version varchar(40),
  rule varchar(64) NOT NULL CHECK (rule = 'last_native_exposure.v1'),
  status varchar(16) NOT NULL CHECK (status IN ('linked','partial','unmatched')),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  revenue_amount_minor numeric(30,0) NOT NULL CHECK (revenue_amount_minor >= 0),
  purchase_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, business_id, store_id, id),
  UNIQUE (organization_id, business_id, store_id, order_id),
  FOREIGN KEY (organization_id, business_id, store_id, order_id)
    REFERENCES kablet_native_orders(organization_id, business_id, store_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, business_id, store_id, checkout_id)
    REFERENCES kablet_native_checkout_sessions(organization_id, business_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, business_id, visitor_identity_id)
    REFERENCES visitor_identities(organization_id, business_id, id) ON DELETE SET NULL (visitor_identity_id),
  FOREIGN KEY (organization_id, business_id, visitor_session_id)
    REFERENCES visitor_sessions(organization_id, business_id, id) ON DELETE SET NULL (visitor_session_id),
  FOREIGN KEY (organization_id, business_id, interaction_session_id)
    REFERENCES interaction_sessions(organization_id, business_id, id) ON DELETE SET NULL (interaction_session_id),
  FOREIGN KEY (organization_id, business_id, decision_id)
    REFERENCES visitor_decisions(organization_id, business_id, id) ON DELETE SET NULL (decision_id),
  FOREIGN KEY (organization_id, business_id, exposure_id)
    REFERENCES experience_exposures(organization_id, business_id, id) ON DELETE SET NULL (exposure_id),
  CHECK ((status = 'linked' AND exposure_id IS NOT NULL AND decision_id IS NOT NULL AND interaction_session_id IS NOT NULL AND composition_id IS NOT NULL AND composition_version IS NOT NULL)
    OR (status = 'partial' AND interaction_session_id IS NOT NULL)
    OR (status = 'unmatched' AND visitor_identity_id IS NULL AND visitor_session_id IS NULL AND interaction_session_id IS NULL AND decision_id IS NULL AND exposure_id IS NULL AND composition_id IS NULL AND composition_version IS NULL))
);

ALTER TABLE kablet_native_order_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kablet_native_order_attributions FORCE ROW LEVEL SECURITY;
CREATE POLICY kablet_native_order_attribution_tenant_isolation ON kablet_native_order_attributions
  USING (organization_id = kablet_current_org() AND business_id = kablet_current_business())
  WITH CHECK (organization_id = kablet_current_org() AND business_id = kablet_current_business());

CREATE OR REPLACE FUNCTION kablet_native_order_attribution_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'native order attribution is immutable';
END;
$$;
CREATE TRIGGER kablet_native_order_attribution_immutable_trigger
  BEFORE UPDATE OR DELETE ON kablet_native_order_attributions
  FOR EACH ROW EXECUTE FUNCTION kablet_native_order_attribution_immutable();

CREATE OR REPLACE FUNCTION kablet_native_capture_order_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE c record;
DECLARE status_value varchar(16);
BEGIN
  SELECT native_visitor_identity_id, native_visitor_session_id, native_interaction_session_id,
         native_decision_id, native_exposure_id, native_composition_id, native_composition_version
    INTO c FROM kablet_native_checkout_sessions
   WHERE organization_id=NEW.organization_id AND business_id=NEW.business_id
     AND store_id=NEW.store_id AND id=NEW.checkout_id;
  status_value := CASE WHEN c.native_exposure_id IS NOT NULL THEN 'linked'
                       WHEN c.native_interaction_session_id IS NOT NULL THEN 'partial'
                       ELSE 'unmatched' END;
  INSERT INTO kablet_native_order_attributions (
    id, organization_id, business_id, store_id, order_id, checkout_id,
    visitor_identity_id, visitor_session_id, interaction_session_id, decision_id, exposure_id,
    composition_id, composition_version, rule, status, currency, revenue_amount_minor, purchase_at
  ) VALUES (
    gen_random_uuid(), NEW.organization_id, NEW.business_id, NEW.store_id, NEW.id, NEW.checkout_id,
    c.native_visitor_identity_id, c.native_visitor_session_id, c.native_interaction_session_id,
    c.native_decision_id, c.native_exposure_id, c.native_composition_id, c.native_composition_version,
    'last_native_exposure.v1', status_value, NEW.currency, NEW.total_amount_minor, NEW.verified_at
  ) ON CONFLICT (organization_id, business_id, store_id, order_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kablet_native_capture_order_attribution_trigger
  AFTER INSERT ON kablet_native_orders FOR EACH ROW EXECUTE FUNCTION kablet_native_capture_order_attribution();

REVOKE ALL ON FUNCTION kablet_native_capture_order_attribution() FROM PUBLIC;
REVOKE ALL ON FUNCTION kablet_native_order_attribution_immutable() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    -- Native intelligence resolves the server-authorized business context before
    -- writing visitor lineage. RLS still limits this read to the active tenant.
    GRANT SELECT ON businesses TO kablet_dev;
    GRANT SELECT, INSERT, UPDATE ON visitor_identities, visitor_sessions, visitor_observations, visitor_state_revisions, visitor_states TO kablet_dev;
    GRANT SELECT ON kablet_native_order_attributions TO kablet_dev;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_control') THEN
    GRANT SELECT ON kablet_native_order_attributions TO kablet_control;
  END IF;
END $$;
