-- Migration: RLS deny-policies for OAuth-client tokens (api-platform subplan 004)
--
-- MANDATORY hardening per DECISIONS §3: OAuth 2.1 access tokens are ordinary
-- Supabase session JWTs, so a leaked token works DIRECTLY against PostgREST
-- and GoTrue, bypassing tRPC entirely (proven by the 2026-07-28 spike,
-- criterion vi — the token could read AND write `profile` via PostgREST).
-- The tRPC allowlist is routing hygiene, not a security boundary; these
-- RESTRICTIVE policies are the control that actually holds.
--
-- Discriminator: OAuth-client tokens carry a `client_id` claim (preserved by
-- 20260728090000); first-party web/native session tokens never do. Every
-- policy below is RESTRICTIVE — it can only narrow what the existing
-- permissive policies grant, and is a no-op for first-party tokens.
--
-- Surface locked down for `client_id`-bearing tokens:
--   * profile                    — ALL direct table access denied, including
--                                  SELECT (the row exposes billing columns:
--                                  plan_selected, subscription_status,
--                                  current_period_end, cancel_at_period_end,
--                                  billing_version, billing_provider). The
--                                  non-billing basics a connected app
--                                  legitimately needs are served by the
--                                  get_connected_profile() accessor below —
--                                  the 005 /api/v1 read surface consumes the
--                                  same accessor.
--   * stripe_customers           — all access denied (billing state).
--   * pending_lifetime_purchases — all access denied (billing state).
--   * email_preferences          — all access denied (account surface).
--   * pending_email_changes      — all access denied (account-takeover surface).
--   * legal_consents             — all access denied (GDPR audit trail).
--   * round / score              — DELETE denied (write-only-by-default
--                                  posture per DECISIONS §8: a connected app
--                                  may log and update rounds, never destroy
--                                  them — relaxable behind a real scope check
--                                  when Supabase Phase-2 scopes ship).
--                                  INSERT/UPDATE/SELECT stay.
--
-- Not touched: webhook_events, otp_verifications (no permissive policies —
-- already inaccessible to non-service roles), and the remaining golf-domain
-- read tables (course/teeInfo/hole) which the `rounds:write` surface needs.

-- ── profile: no direct table access for OAuth-client tokens ─────────────────

-- NOTE: deliberately NOT using the `(SELECT auth.jwt() ...)` initplan wrapper
-- here. The permissive "Users can update their own profile" WITH CHECK
-- subqueries public.profile, which expands profile's SELECT policies inside a
-- profile policy — with an initplan-subquery qual in the SELECT policy that
-- trips Postgres' policy-recursion detector ("infinite recursion detected in
-- policy for relation profile", 42P17). The direct call form does not.
CREATE POLICY "OAuth client tokens cannot select profile"
  ON public.profile
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens cannot insert profile"
  ON public.profile
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens cannot update profile"
  ON public.profile
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens cannot delete profile"
  ON public.profile
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

-- ── billing state: fully invisible to OAuth-client tokens ───────────────────

CREATE POLICY "OAuth client tokens have no access to stripe customers"
  ON public.stripe_customers
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens have no access to pending purchases"
  ON public.pending_lifetime_purchases
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

-- ── account/profile-sensitive surfaces ──────────────────────────────────────

CREATE POLICY "OAuth client tokens have no access to email preferences"
  ON public.email_preferences
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens have no access to pending email changes"
  ON public.pending_email_changes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens have no access to legal consents"
  ON public.legal_consents
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

-- ── rounds: write-only-by-default — no destructive capability ───────────────
-- A connected app can log (INSERT), correct (UPDATE) and read (SELECT) the
-- user's rounds, but never DELETE them (DECISIONS §8 posture; revisit behind
-- a real scope check when Supabase Phase-2 scopes ship).

CREATE POLICY "OAuth client tokens cannot delete rounds"
  ON public.round
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

CREATE POLICY "OAuth client tokens cannot delete scores"
  ON public.score
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'client_id') IS NULL);

-- ── Safe profile accessor for connected apps ────────────────────────────────
-- With direct profile SELECT denied above, this is the ONLY way a
-- `client_id`-bearing token reads profile data: the non-billing basics,
-- nothing else. The 005 /api/v1 read surface consumes the same accessor.
--
-- SECURITY DEFINER because the caller's role is blocked from the profile
-- table by the restrictive policy above — the function runs as its owner to
-- bypass RLS, and re-implements the row filter itself with a hard
-- `id = auth.uid()` predicate (exactly the permissive SELECT policy's
-- predicate), so it can never return another user's row. search_path is
-- pinned to prevent search_path attacks. Callable by both first-party and
-- OAuth-client tokens; anon gets nothing (auth.uid() IS NULL matches no row).

CREATE OR REPLACE FUNCTION public.get_connected_profile()
RETURNS TABLE (
  id uuid,
  name text,
  handicap_index numeric,
  verified boolean,
  created_at timestamp
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p."handicapIndex" AS handicap_index,
    p.verified,
    p."createdAt" AS created_at
  FROM public.profile p
  WHERE p.id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_connected_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_connected_profile() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_connected_profile() TO authenticated;

COMMENT ON FUNCTION public.get_connected_profile IS
  'Safe profile accessor for OAuth-client (client_id-bearing) tokens: returns ONLY the caller''s non-billing profile basics (id, name, handicap index, verified, created_at). SECURITY DEFINER to bypass the restrictive profile SELECT deny-policy, with the row filter hard-coded to auth.uid() and search_path pinned. Consumed by the /api/v1 read surface (subplan 005).';
