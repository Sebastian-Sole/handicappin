-- Revoke EXECUTE on handicap-update RPCs from `authenticated`.
--
-- Background:
--   The original migration (20251207213412_add_process_handicap_updates_function.sql)
--   granted EXECUTE on `process_handicap_updates(JSONB, UUID, NUMERIC, BIGINT)`
--   and `process_handicap_no_rounds(UUID, NUMERIC, BIGINT)` to BOTH `authenticated`
--   and `service_role`. The `authenticated` grant was unnecessary and a
--   privilege-escalation risk: these RPCs accept an arbitrary `user_id`
--   argument and rewrite the round table, profile.handicapIndex, and the
--   handicap_calculation_queue rows for that user without checking
--   `auth.uid()`. Any logged-in client could call them and overwrite another
--   user's handicap state.
--
--   These functions are only ever invoked from the
--   `process-handicap-queue` Edge Function, which uses the service role key.
--   No app-level code (tRPC, Server Actions, route handlers) calls them.
--   Therefore revoking from `authenticated` is safe: the legitimate caller
--   (service role) keeps its grant and continues working unchanged.
--
-- This is an additive migration; it leaves the original migration untouched
-- so anyone who has already applied 20251207213412 won't see a conflict.

REVOKE EXECUTE ON FUNCTION process_handicap_updates(JSONB, UUID, NUMERIC, BIGINT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_handicap_no_rounds(UUID, NUMERIC, BIGINT) FROM authenticated;
