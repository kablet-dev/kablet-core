-- Verified webhook acceptance uses INSERT ... RETURNING for durable
-- acknowledgement and deduplication. Only the trusted control role may read
-- the inbox rows involved in that operation; runtime roles remain unchanged.
GRANT SELECT ON kablet_provider_webhook_inbox TO kablet_control;

CREATE POLICY kablet_control_provider_webhook_read ON kablet_provider_webhook_inbox
  FOR SELECT USING (current_user = 'kablet_control');
