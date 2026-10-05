ALTER TABLE visitor_decisions DROP CONSTRAINT IF EXISTS visitor_decisions_decision_type_check;
ALTER TABLE visitor_decisions ADD CONSTRAINT visitor_decisions_decision_type_check CHECK (decision_type IN ('clarify_intent','present_offering','request_qualification','request_time_window','offer_next_step','no_safe_decision'));
ALTER TABLE visitor_decisions ADD COLUMN IF NOT EXISTS qualification_question_key text;
ALTER TABLE visitor_decisions ADD COLUMN IF NOT EXISTS qualification_question_prompt text;
ALTER TABLE visitor_decisions ADD COLUMN IF NOT EXISTS qualification_question_options jsonb;
