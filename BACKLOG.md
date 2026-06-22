# Backlog

## Ship the Mobile App (iOS) — owner action required

The native iOS app (`apps/native`) and cross-platform billing are **code-complete and merged to `main`** (PRs #127→#130). Nothing charges anyone and the app runs a labelled billing mock until the console/account setup below is done — so this is **owner work, not engineering work**. Authoritative step-by-step: **`docs/billing-runbook.md`**. This section is the index of everything that stands between `main` and a shipped App Store build.

### A. Billing console setup (only the owner can do this)

Follow `docs/billing-runbook.md` §1–§3 in order — agreements first, because nothing else is testable without them. In brief:

1. **App Store Connect** (`docs/billing-runbook.md` §1)
   - Accept the **Paid Applications** agreement; complete **banking + tax** (hard blocker — IAPs aren't testable in TestFlight without these).
   - Enroll in the **Small Business Program** (15% vs 30% commission) — not retroactive, do it before launch.
   - Create the two auto-renewables in ONE subscription group and the one non-consumable, with **exact** product IDs (a typo means purchases grant nothing): `com.handicappin.premium.yearly` ($19/yr), `com.handicappin.unlimited.yearly` ($29/yr), `com.handicappin.lifetime` ($149). Rank Unlimited above Premium so Apple handles upgrade/downgrade.
   - Create a **sandbox tester** account.
2. **RevenueCat console** (`docs/billing-runbook.md` §2)
   - New project → add the iOS app (`com.handicappin.app`) → upload App Store Connect credentials.
   - Add the three products, create three **entitlements** named exactly `premium` / `unlimited` / `lifetime`, build the `default` offering and mark it current.
   - Copy the **public Apple SDK key** (`appl_…`, for the app) and the **secret key** (`sk_…`, for the reconcile script).
   - Add a **webhook** → `https://handicappin.com/api/webhooks/revenuecat` with an `Authorization` value you generate (`openssl rand -hex 32`). **Do not** enable RevenueCat's Stripe/Web Billing integration — Stripe stays owned by the existing web webhook.
3. **Environment variables** (`docs/billing-runbook.md` §3)
   - **Vercel (web)**: `REVENUECAT_WEBHOOK_AUTH_TOKEN` (must equal the webhook Authorization value verbatim) and `REVENUECAT_API_KEY` (the `sk_…` secret). Redeploy web **before** any purchase can happen.
   - **Native (`apps/native/eas.json`)**: replace `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_SET-ME` with the public key in the `preview`/`production` profiles only (leave `development` unset so CI/sim keep using the mock). Also set the real `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` for preview/production (still `SET-ME`).

### B. Build, test, submit

4. **TestFlight sandbox pass** (`docs/billing-runbook.md` §4) — `eas build --profile preview --platform ios` → `eas submit` → install → sign the device into the sandbox account → walk the full matrix (purchase / upgrade / downgrade / cancel / expire / lifetime / restore / Stripe-sanity / reconcile dry-run). Sandbox renewals are ~1 hour.
5. **App Store submission** (`docs/billing-runbook.md` §5) — submit the build **with the in-app purchases attached to the version** (reviewed together). The required compliance pieces are already in the app: auto-renew disclosure + Terms/Privacy links (3.1.2) and the in-app delete-account entry (5.1.1(v)).
6. **Post-approval** — spot-check one real purchase + refund it, run `node scripts/reconcile-billing.mjs` (dry run), confirm Small Business Program enrollment.

### C. Known by-design edges (operate, don't "fix")

- **Apple lifetime refunds don't auto-revoke** (lifetime is absorbing by design) — revoke manually (set profile to free); the reconcile dry-run flags the mismatch.
- **Double contracts** (someone actively paying both Stripe and Apple) — the webhook keeps max entitlement and raises a Sentry `billing.double_contract` alert; cancel one side manually.
- **Free-tier selection and the EARLY100 lifetime promo remain web flows** — the native paywall says so on those CTAs.

### D. Deferred native features (not ship-blockers; track separately)

From the native build (PR #129), intentionally not yet ported — the app links out to web or hides these:
- Google OAuth sign-in (needs an iOS OAuth client configured).
- Email change / data export / account deletion flows (native links to the web versions).
- AI scorecard photo upload and edit-tee on `rounds/add`.
- Advanced / educational calculator interactivity (native shows the core calculators).
- Android build + submission (iOS-only for now).
- Per-screen dark-mode visual-parity captures.

### E. Open code follow-ups (tracked as issues, non-blocking)

- **#131** — destructive-hue color pairs still marginally below WCAG AA.
- **#132** — automated contrast-regression gate over the token contract.
- **#134** — extend the billing-version optimistic lock to the Stripe webhook write closures (the Apple side already has it).

**Context**: Output of the #127→#130 PR stack (design-system parity → monorepo + native bring-up → 16 native screens → cross-platform billing). Architecture ledger: `docs/billing-implementation-handoff.md` §1. Implementation log: `docs/billing-implementation-log.md`. Web↔native parity rules: `docs/web-native-parity.md`.

---

## Rejected Submission Re-submission UX

Users whose submissions are rejected currently have no clear path to resubmit. The rejected round remains in their history with no explanation or action. A future improvement should:

- Show rejection reason to the user (from admin notes)
- Allow users to resubmit a corrected version of a rejected round/tee
- Provide a "submission history" view showing pending, approved, and rejected submissions

**Context**: Identified during review of the tee/course approval workflow plan (`.claude/plans/tee-course-approval-workflow.md`).

---

## Course/Tee Submissions Without a Round

Currently, the `submissions` table and workflow are tightly coupled to round submission — a course or tee can only be submitted as part of submitting a round. In the future, users should be able to:

- Submit a new course without needing to attach a round
- Submit tee edits independently of round entry
- Pre-populate the course database via community contributions

**Context**: The `submissions.roundId` FK is nullable to support this, but no code path currently creates a submission without a round.

---

## Playwright E2E Scaffolding

Playwright is not yet installed. Before E2E specs can be written, the following need to be set up:

- Install `@playwright/test` and `@axe-core/playwright`; add `playwright.config.ts` with `keyboard-only`, `reflow-320`, and `forced-colors` projects
- Scaffold `e2e/` at the project root with `a11y-test.ts` (custom fixture exposing `makeAxeBuilder()`) and `a11y-assertions.ts` (the helpers table in the e2e-testing skill)
- Seeding scripts in `e2e/setup/` using the Supabase service-role client and Stripe test-mode SDK; `storageState` files for customer and admin sessions
- CI workflow (`.github/workflows/e2e.yml`) that installs Playwright browsers and uploads the report
- Fill in `.claude/skills/e2e-testing/references/personas/*.md` (first-time visitor, returning golfer, admin moderator, mobile-only, screen-reader user) and `references/user-test-contexts/*.md` (one per C-/A- scenario) as specified in `.claude/ONBOARDING.md` §4.7

**Context**: E2E skill and testing-modes reference are adapted to this domain but describe infrastructure that doesn't exist yet. See `.claude/skills/e2e-testing/SKILL.md`.
