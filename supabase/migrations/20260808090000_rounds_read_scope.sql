-- Migration: Stamp `rounds:read rounds:write` on OAuth-client tokens (D11)
--
-- Context (api-platform D11, ratified 2026-08-08):
-- The custom_access_token_hook (20260728090000) stamped a single scope,
-- `rounds:write`, on every OAuth-client token. That made a read-only OAuth
-- client structurally impossible — there was no scope name a read could gate
-- on that a write-only token would lack. D11 mints `rounds:read`, and scoped
-- read endpoints (`GET /v1/rounds`) now gate on rounds:read OR rounds:write.
--
-- This migration replaces the hook so OAuth-client tokens are stamped
-- `rounds:read rounds:write` (appended to any GoTrue-granted scopes,
-- space-separated per RFC 6749 §3.3) instead of `rounds:write` alone. For
-- every existing token this is a pure relaxation: a `rounds:write` token
-- passes every gate it passed before, and tokens minted before this
-- migration keep working because the read gate accepts `rounds:write` too.
--
-- Everything else is carried forward from 20260728090000 UNCHANGED:
--   * the preserved-claims whitelist (incl. `client_id` and `ref`);
--   * the OAuth early-return with NO billing claims (DECISIONS §3 — a
--     connected app must not learn the billing tier from its own token);
--   * first-party tokens: no scope claim, billing stamped into app_metadata
--     from public.profile with the same defensive defaults.
--
-- Why both scopes are stamped UNCONDITIONALLY (Phase-1 fixed-capability
-- model, unchanged from PR #167): Supabase's OAuth beta has no per-client
-- scope management, so every OAuth grant carries the identical capability
-- set, enforced uniformly by RLS regardless of this claim. The names exist so
-- /api/v1 enforcement points are written against `scope` from day one and do
-- not move when real scopes ship. Tripwire (DECISIONS §8) still stands: NO
-- external third-party client may be onboarded until per-client scopes exist —
-- derive this stamp from the client's granted scopes at that point.
--
-- Security: SECURITY DEFINER with safe search_path (unchanged).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Required to access profile table from auth context
SET search_path = public  -- Prevent search_path attacks
STABLE  -- Function doesn't modify database
AS $$
DECLARE
  original_claims jsonb;
  new_claims jsonb;
  claim text;
  rec record;
  app_meta jsonb;
BEGIN
  -- Get original claims from event
  original_claims := event->'claims';
  new_claims := '{}'::jsonb;

  -- Preserve all standard JWT claims (as per Supabase docs) PLUS the OAuth
  -- 2.1 server claims: `client_id` identifies the OAuth client the token was
  -- issued to (absent on first-party sessions) and `ref` is the project ref
  -- GoTrue may stamp on hosted projects.
  FOREACH claim IN ARRAY ARRAY[
    'iss',
    'aud',
    'exp',
    'iat',
    'sub',
    'role',
    'aal',
    'session_id',
    'email',
    'phone',
    'is_anonymous',
    'amr',
    'user_metadata',
    'client_id',
    'ref'
  ] LOOP
    IF original_claims ? claim THEN
      new_claims := jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
    END IF;
  END LOOP;

  -- OAuth-client tokens: NO billing claims. Billing state is mandatory-denied
  -- to `client_id` principals (DECISIONS §3) — a connected app must not learn
  -- the billing tier by decoding its own token. Pass any GoTrue-provided
  -- app_metadata through untouched, stamp the forward-compatible scope claim
  -- (appended to GoTrue-granted scopes, space-separated per RFC 6749 §3.3),
  -- and return early.
  --
  -- D11: `rounds:read rounds:write`, not `rounds:write` alone — reads gate on
  -- either scope, writes on `rounds:write` only, so a read-only client is
  -- representable while every existing token keeps every capability it had.
  IF new_claims ? 'client_id' THEN
    IF original_claims ? 'app_metadata' THEN
      new_claims := jsonb_set(new_claims, '{app_metadata}', original_claims->'app_metadata');
    END IF;
    new_claims := jsonb_set(
      new_claims,
      '{scope}',
      to_jsonb(trim(BOTH ' ' FROM COALESCE(original_claims->>'scope', '') || ' rounds:read rounds:write'))
    );
    RETURN jsonb_build_object('claims', new_claims);
  END IF;

  -- Get user's MINIMAL billing information from profile table
  -- Only select fields that will be in JWT (keep it tiny!)
  SELECT
    COALESCE(plan_selected, 'free')::text AS plan,
    COALESCE(subscription_status, 'active')::text AS status,
    current_period_end,  -- NULL for free/lifetime
    COALESCE(cancel_at_period_end, false)::boolean AS cancel_at_period_end,
    COALESCE(billing_version, 1)::integer AS billing_version
  INTO rec
  FROM public.profile
  WHERE id = (event->>'user_id')::uuid;

  -- Handle missing profile (shouldn't happen, but be defensive)
  IF NOT FOUND THEN
    rec.plan := 'free';
    rec.status := 'active';
    rec.current_period_end := NULL;
    rec.cancel_at_period_end := false;
    rec.billing_version := 0;
  END IF;

  -- Build app_metadata with billing information
  -- Start with existing app_metadata if present, otherwise empty object
  IF original_claims ? 'app_metadata' THEN
    app_meta := original_claims->'app_metadata';
  ELSE
    app_meta := '{}'::jsonb;
  END IF;

  -- Add billing to app_metadata
  app_meta := jsonb_set(
    app_meta,
    '{billing}',
    jsonb_build_object(
      'plan', rec.plan,
      'status', rec.status,
      'current_period_end', rec.current_period_end,
      'cancel_at_period_end', rec.cancel_at_period_end,
      'billing_version', rec.billing_version
    )
  );

  -- Set the complete app_metadata back into claims (first-party tokens only —
  -- OAuth-client tokens returned early above, without billing claims).
  new_claims := jsonb_set(new_claims, '{app_metadata}', app_meta);

  -- Return event with modified claims
  RETURN jsonb_build_object('claims', new_claims);
END;
$$;

-- Grants are preserved across CREATE OR REPLACE, but restate them so this
-- migration is self-sufficient on a fresh database.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profile TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Custom Access Token Hook: Injects MINIMAL billing information from profile table into JWT claims for FIRST-PARTY tokens only; preserves OAuth 2.1 server claims (client_id, ref) and stamps a forward-compatible scope claim (rounds:read rounds:write, D11) on OAuth-client tokens, which get NO billing claims. Runs automatically on token issue/refresh. SECURITY DEFINER with safe search_path.';
