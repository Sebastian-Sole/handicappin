-- Close the default-PUBLIC grant on setup_handicap_queue_cron().
--
-- The function is SECURITY DEFINER and reschedules a pg_cron job. PostgreSQL
-- grants EXECUTE on functions to PUBLIC by default unless explicitly revoked,
-- so any authenticated user could call this function and reschedule the cron.
-- The function is idempotent so blast radius is low, but the grant shouldn't
-- exist.
--
-- Mirrors the pattern in 20260502104218_revoke_handicap_rpc_from_public.sql.

REVOKE EXECUTE ON FUNCTION public.setup_handicap_queue_cron() FROM PUBLIC, anon, authenticated;
