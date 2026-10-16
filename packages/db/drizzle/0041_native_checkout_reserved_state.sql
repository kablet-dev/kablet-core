-- A confirmed reservation is distinct from payment_pending; no payment has
-- started in this slice.
ALTER TABLE kablet_native_checkout_sessions
  DROP CONSTRAINT IF EXISTS kablet_native_checkout_sessions_status_check;
ALTER TABLE kablet_native_checkout_sessions
  ADD CONSTRAINT kablet_native_checkout_sessions_status_check
  CHECK (status IN ('created', 'awaiting_confirmation', 'reservation_pending', 'reserved', 'payment_pending', 'payment_unknown', 'failed', 'expired', 'cancelled', 'completed'));
