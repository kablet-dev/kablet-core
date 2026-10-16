-- Repair application-role privileges for the native checkout reservation
-- service. RLS remains the tenant/store authorization boundary.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kablet_dev') THEN
    GRANT SELECT, INSERT, UPDATE ON kablet_native_checkout_sessions, kablet_native_inventory_reservations TO kablet_dev;
    GRANT SELECT, INSERT ON kablet_native_checkout_lines, kablet_native_reservation_mutations TO kablet_dev;
  END IF;
END $$;
