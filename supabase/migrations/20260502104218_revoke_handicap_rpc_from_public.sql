-- Close the remaining grant path on the handicap RPCs.
--
-- The previous migration (20260502094813_revoke_handicap_rpc_from_authenticated.sql)
-- only revoked EXECUTE from `authenticated`. PostgreSQL grants EXECUTE on
-- functions to PUBLIC by default unless explicitly revoked, and `anon`
-- inherits via PUBLIC. This means an unauthenticated caller could still
-- invoke these RPCs via PostgREST, defeating the original lockdown.
--
-- Mirror the pattern used for `custom_access_token_hook` in
-- 20251025154500_fix_jwt_hook_null_handling.sql:122.

REVOKE EXECUTE ON FUNCTION process_handicap_updates(JSONB, UUID, NUMERIC, BIGINT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION process_handicap_no_rounds(UUID, NUMERIC, BIGINT) FROM anon, public;
