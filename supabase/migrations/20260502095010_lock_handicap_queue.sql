-- Lock down handicap_calculation_queue.
--
-- The original migration (20251207150151_exotic_sabra.sql) created the queue
-- table without enabling Row Level Security and without revoking grants from
-- the `authenticated`/`anon` roles. PostgREST exposes any table in the
-- `public` schema that those roles can SELECT/INSERT/UPDATE/DELETE on, which
-- means an authenticated user could potentially read or tamper with the
-- queue via the REST API.
--
-- The queue is internal infrastructure: only the database trigger that
-- enqueues rounds (running as `postgres`) and the edge function that drains
-- it (running as `service_role`) need access. Users have no business hitting
-- it directly. We therefore enable RLS as defense-in-depth (no policies =
-- deny by default for non-superuser roles) AND revoke table-level
-- privileges from the public-facing roles.

ALTER TABLE public.handicap_calculation_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.handicap_calculation_queue FROM authenticated, anon;

GRANT ALL ON TABLE public.handicap_calculation_queue TO service_role;
