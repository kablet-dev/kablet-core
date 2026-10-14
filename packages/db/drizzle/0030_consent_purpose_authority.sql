-- Runtime action consent is a first-class control-plane purpose. Revocation is
-- matched by purpose and version so unrelated consent categories do not block it.
ALTER TABLE kablet_consents DROP CONSTRAINT IF EXISTS kablet_consents_purpose_check;
ALTER TABLE kablet_consents ADD CONSTRAINT kablet_consents_purpose_check CHECK (purpose IN ('contact','personalization','intelligence_context','analytics','follow_up'));
