ALTER TABLE ai_intent_accounting_periods
  ADD COLUMN IF NOT EXISTS released_units bigint NOT NULL DEFAULT 0 CHECK (released_units >= 0);

ALTER TABLE ai_intent_accounting_periods
  ADD CONSTRAINT ai_intent_accounting_periods_disposition_check
  CHECK (consumed_units + released_units + uncertain_units <= reserved_units);
