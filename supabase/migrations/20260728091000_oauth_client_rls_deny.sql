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
--   * profile                    — writes denied (SELECT stays: the /api/v1
--                                  handicap surface needs profile reads, and
--                                  the token already carries billing claims).
--   * stripe_customers           — all access denied (billing state).
--   * pending_lifetime_purchases — all access denied (billing state).
--   * email_preferences          — all access denied (account surface).
--   * pending_email_changes      — all access denied (account-takeover surface).
--   * legal_consents             — all access denied (GDPR audit trail).
--
-- Not touched: webhook_events, otp_verifications (no permissive policies —
-- already inaccessible to non-service roles), and the golf-domain tables
-- (round/score/course/...) which are exactly what `rounds:write` tokens are
-- for (enforced at the /api/v1 mount, subplan 005).

-- ── profile: deny all writes from OAuth-client tokens ───────────────────────

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
