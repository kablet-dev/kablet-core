-- The control-plane callback consumes OAuth state before it knows the tenant
-- bound to that state. Allow only the trusted control role to see the row
-- returned by its single-use UPDATE; merchant tenant policies remain intact.
CREATE POLICY kablet_control_provider_oauth_read ON kablet_provider_oauth_states
  FOR SELECT USING (current_user = 'kablet_control');
