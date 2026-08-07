-- get_connected_entitlement(): plan-blind entitlement accessor for /api/v1
-- (api-platform plan 010 §T3; spec frozen in 005-phase0-contract.md §1).
--
-- Why it exists: OAuth-client (client_id-bearing) tokens are denied SELECT on
-- public.profile by the RESTRICTIVE policy in 20260728091000_oauth_client_rls_deny.sql,
-- so `getComprehensiveUserAccess` sees zero rows and reports every connected
-- request as plan-less (403 plan_required for fully provisioned users). This
-- SECURITY DEFINER accessor — the same mould as get_connected_profile() —
-- answers the ONE question a connected app may ask ("may this user write
-- another round?") while keeping the authorization boundary in the database.
--
-- It returns ONLY four derived facts. It deliberately does NOT return
-- plan_selected, subscription_status, current_period_end, cancel_at_period_end,
-- billing_version, billing_provider, or any Stripe identifier: a connected app
-- learns whether the user may write another round, never what they pay.
--
--   * is_provisioned       — profile.plan_selected IS NOT NULL.
--   * has_unlimited_rounds — derived from the plan without naming it: every
--                            non-free plan (premium / unlimited / lifetime per
--                            the plan_selected CHECK constraint) is unlimited,
--                            matching getComprehensiveUserAccess
--                            (apps/web/utils/billing/access-control.ts). The
--                            RPC intentionally does not read
--                            subscription_status: lapsed-subscription nuance,
--                            if /v1 ever needs it, must be added HERE as
--                            another derived boolean — never guessed by an
--                            adapter (contract §1).
--   * rounds_limit         — NULL when unlimited; otherwise the free-tier
--                            lifetime cap (25, mirroring FREE_TIER_ROUND_LIMIT
--                            in apps/web/utils/billing/constants.ts).
--   * rounds_used          — COUNT of the caller's NON-QUARANTINED rounds
--                            only (quarantined = false): accept-and-quarantine
--                            rows are stored but must not consume free-tier
--                            quota, matching the counting site in
--                            access-control.ts. So rounds_used never inflates
--                            past rounds_limit because of quarantined rows.
--
-- Zero rows (not a row of NULLs) when the caller has no profile row at all —
-- reachable, since provisioning is "create the profile row if missing". The
-- /v1 adapter maps zero rows to 403 plan_required + a Sentry alert.
--
-- REQUIRED CAVEAT (contract §1): `rounds_limit` is safe to expose only while
-- every finite cap equals the single free-tier value. If a future plan ever
-- carries a DIFFERENT finite cap, `rounds_limit` becomes a plan fingerprint
-- and leaks the tier this function exists to hide — revisit it at that point
-- (return only a boolean "may write another round" instead).
--
-- Hardening: `search_path = ''` with fully-qualified references
-- (public.profile, public.round, auth.uid()), per the repo's recent
-- SECURITY DEFINER precedent (20260502095005_enqueue_trigger_security_definer.sql)
-- rather than get_connected_profile()'s older `search_path = public`. The row
-- filter is hard-coded to auth.uid(); the function takes no arguments.

CREATE OR REPLACE FUNCTION public.get_connected_entitlement()
RETURNS TABLE (
  is_provisioned       boolean,
  has_unlimited_rounds boolean,
  rounds_limit         integer,
  rounds_used          integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    (p.plan_selected IS NOT NULL) AS is_provisioned,
    (p.plan_selected IS NOT NULL AND p.plan_selected <> 'free')
      AS has_unlimited_rounds,
    CASE
      WHEN p.plan_selected IS NOT NULL AND p.plan_selected <> 'free'
        THEN NULL
      ELSE 25
    END AS rounds_limit,
    (
      SELECT count(*)::integer
      FROM public.round r
      WHERE r."userId" = auth.uid()
        AND r.quarantined = false
    ) AS rounds_used
  FROM public.profile p
  WHERE p.id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_connected_entitlement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_connected_entitlement() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_connected_entitlement() TO authenticated;

COMMENT ON FUNCTION public.get_connected_entitlement IS
  'Plan-blind entitlement accessor for the /api/v1 surface (contract 005 §1): returns ONLY four derived facts for the calling user (is_provisioned, has_unlimited_rounds, rounds_limit, rounds_used) — never plan name, subscription status, period, or payment identifiers. SECURITY DEFINER so client_id-bearing OAuth tokens (denied direct SELECT on profile by RLS) can still answer "may this user write another round?"; row filter hard-coded to auth.uid(); search_path pinned to ''''. rounds_used counts non-quarantined rounds only. Returns ZERO rows when no profile row exists. CAVEAT: rounds_limit is safe to expose only while every finite cap equals the single free-tier value (25); if a future plan carries a different finite cap it becomes a plan fingerprint — revisit then.';
