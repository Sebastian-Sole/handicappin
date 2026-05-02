-- Lock down webhook_events.
--
-- Same shape as handicap_calculation_queue — internal infrastructure
-- written to by the Stripe webhook handler (service_role) and never read
-- by client/app code. Currently has no RLS and inherits default
-- PostgREST grants on the public schema, so authenticated users could
-- enumerate Stripe event IDs / user IDs / processing status via the REST
-- API. Lock it down: enable RLS (no policies = deny by default for
-- non-service roles) AND revoke table-level privileges from
-- authenticated/anon.

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.webhook_events FROM authenticated, anon;
GRANT ALL ON TABLE public.webhook_events TO service_role;
