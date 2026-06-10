# Native Implementation Log

Running record of every decision made under the autonomy protocol
(docs/native-implementation-handoff.md §0b), every waiver, and anything
deferred. Newest entries appended per section.

## Decisions

### D1 — tRPC typing: untyped client + zod at the trust boundary (2026-06-10)

**What:** Native calls the web tRPC server through `createTRPCUntypedClient`
(`apps/native/lib/api/client.ts`); every response is validated with a zod
schema before use (`lib/api/schemas/`).

**Why:** `import type { AppRouter } from apps/web` is not feasible: the apps
have colliding `@/*` TS path aliases (both map to their own root, and web's
server graph imports `@/db`, `@/env`, … which native's tsc program cannot
resolve), and pnpm's default isolated linker means web's dependency types
(next, drizzle, stripe, …) are invisible to native's program. The repo's own
convention ("validate anything that crosses a trust boundary … external API
responses with zod") treats the web API from native's side as exactly that.
Runtime shape validation also catches server drift the moment it happens
instead of silently rendering wrong data.

**Alternatives rejected:** (a) tsconfig `paths` fallback `"@/*": ["./*",
"../web/*"]` — works until any same-path file exists in both apps, then
resolves silently wrong; couples native's gate to web's entire type graph.
(b) Extracting the routers into `packages/api` — the routers import web's
db/lib/utils closure; that's a web-app refactor far out of scope. (c)
Declaration-emit codegen — alias rewriting toolchain, fragile.

### D2 — Local-dev env defaults committed in app.config.ts (2026-06-10)

`app.config.ts` defaults `extra.env` to the LOCAL Supabase stack
(`http://127.0.0.1:54321`, the well-known public demo anon key that every
`supabase start` instance ships with) and `http://localhost:3000` for the
tRPC API. These are not secrets. `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` override per
environment (eas.json profiles later).

### D3 — Session persistence via expo-secure-store; Android size caveat (2026-06-10)

Per handoff §7.2, tokens persist with `expo-secure-store`. Android's
SecureStore warns above 2048-byte values and a full Supabase session JSON can
exceed that; iOS keychain (the sim-complete target) has no such limit.
Deferred: a chunking/encrypted-AsyncStorage adapter before any Android
milestone.

### D4 — Foundation sequencing: tab shell + chart wrappers land with their first consumer (2026-06-10)

§7 lists the tab shell 4th and charts 6th, but the route gate makes a
screenless `(tabs)` group pointless (layouts add no routes) and chart
wrappers are untestable with no chart screen. The tab-shell STRUCTURE is
decided now (see D5); the files land with the home port, chart wrappers with
the statistics port. Billing mock built now (lib/billing/, RevenueCat-shaped,
real state via tRPC profile fields plan_selected/subscription_status/
current_period_end/cancel_at_period_end).

### D5 — Tab mapping keeps every tab a SHARED route (2026-06-10)

Bottom tabs (ledger: Home, Rounds, Statistics, Profile) map to:

| Tab | File | Route slug |
|---|---|---|
| Home | `(tabs)/index.tsx` | `""` (shared) |
| Rounds | `(tabs)/dashboard/[id].tsx` | `dashboard/[id]` (shared) |
| Statistics | `(tabs)/statistics/index.tsx` + nested `courses/[courseId]` | `statistics`, `statistics/courses/[courseId]` (shared) |
| Profile | `(tabs)/profile/[id].tsx` | `profile/[id]` (shared) |

Dynamic-segment tabs get their concrete `href` (`/dashboard/<uid>`,
`/profile/<uid>`) computed from the session in the tabs layout — the
expo-router `Tabs.Screen href` option exists for exactly this. Web's
`dashboard/[id]` IS the rounds dashboard, so the Rounds tab pointing at it
keeps native 1:1 with web instead of inventing a native-only `rounds` route.
No INTENTIONAL.nativeOnly entries needed beyond `__gallery` (which gets
declared when home lands and the bring-up gallery moves there). Auth screens
live in an `(auth)` group on the root stack, matching web's `(auth)` group
slugs exactly.

### D6 — Calculators reachable from Profile (2026-06-10)

Ledger left Home vs Profile as my call: Profile hosts the link (it is the
settings-like surface; Home stays focused on stats + recent rounds, matching
web's logged-in homepage which has no calculators entry point either).
`calculators.tsx` lives on the root stack.

### D7 — Dark mode: generator now emits `@media (prefers-color-scheme: dark)` (2026-06-10)

Validated on-simulator per handoff §6 BEFORE porting screens: with the
`.dark`-class strategy the gallery stayed light when the sim switched to dark
appearance — the class compiles but never activates (no DOM node carries it
on native). Applied the handoff's sanctioned fix in
`packages/tokens/src/generate.mjs serializeNativeGlobalCss`: dark vars now
ride `@media (prefers-color-scheme: dark)` (react-native-css maps it to the
OS Appearance API) and `@custom-variant dark` is media-based. `tokens.ts`
per-mode shape unchanged; generator tests updated (37 pass). Re-verified
on-sim: gallery switches dark AND back to light at runtime. Web is untouched
(its `.dark` class strategy stays as-is — only the NATIVE emission changed).

### D8 — Native cn() registers the generated typography ramp in tailwind-merge (2026-06-10)

First ported screen surfaced it: twMerge classifies `text-heading-1` (and
the whole ramp) as a text COLOR, so `cn("text-heading-1 text-foreground")`
silently dropped the ramp class — native pairs ramp+color on every Text
(no DOM cascade to inherit color from), web rarely does. `lib/utils.ts`
extends twMerge with the ramp (derived from `tokens.typography` keys, so it
tracks the contract) as a font-size class group, plus web's semantic-spacing
extension. Also fixed in the same pass: AuthFormShell's centered `w-full`
column collapsed to 0 width under Yoga (percentage width vs content-sized
parent) — native shells use default cross-axis stretch + padding instead of
items-center + max-w (web's max-w-sm never binds inside phone padding).

### D9 — Capture tooling: Maestro-driven deep links + per-mode web capture (2026-06-10)

`simctl openurl` with a custom scheme pops an "Open in …?" system dialog on
EVERY call (capture caught the dialog, not the screen). compare-screen.sh now
navigates through `.maestro/utils/nav-deeplink.yaml` (openLink + optional
dialog accept) and falls back to simctl when Maestro is absent. The web side
now pins `agent-browser set media <mode>` and the sim appearance to the same
MODE (light default) so captures compare like-for-like. Also: zero-size
markers (fonts-ready, data-settled) are not Maestro-"visible" — flows assert
real content; the markers stay for the capture-hygiene gate's a11y-tree scan.

## Per-screen evidence

### login — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/login/{native,web,compare}.png (light).
- Rubric verification/rubrics/login.yaml, judged in-band (no ANTHROPIC_API_KEY):
  - layout_structure PASS — same order/grouping (title, description, fields,
    primary CTA, divider, Google, link row); native intentionally has no web
    navbar/footer chrome.
  - color_tokens PASS — background/foreground/muted/primary/input borders all
    from tokens; primary CTA green with primary-foreground label.
  - type_hierarchy PASS — H1 extra-bold dominant, body-muted description,
    small labels, uppercase meta divider; Inter everywhere.
  - components_present PASS — 40px bordered inputs, full-width primary
    button, outlined Google button with brand-color G, two link buttons
    (underline-at-rest removed to match web's hover-only underline).
- Maestro `.maestro/flows/login.yaml` PASS on live sim + local Supabase:
  renders, accepts input, real backend rejects bad credentials, visible
  error feedback. Positive round-trip deferred to auth-roundtrip flow (needs
  home + logout).
- Google sign-in: visual-parity button present; functional OAuth deferred
  (see Deferred).

### signup — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/signup/{native,web,compare}.png (light).
- Rubric verification/rubrics/signup.yaml, judged in-band: all four items
  PASS. Iterated twice: helper texts aligned to web's FormDescription
  (text-body-sm muted), legal links aligned to web's LegalDialog trigger
  style (muted + underline, not primary).
- Maestro `.maestro/flows/signup.yaml` PASS: form accepts input, zod consent
  refine blocks submit with the exact web error message. Full account
  creation exercised in the verify-signup QA (avoids minting junk users per
  flow run).
- Sim environment note: password AutoFill sheets render out-of-process and
  are INVISIBLE to Maestro — disabled on the sim once (documented in
  .maestro/README.md). Keyboard dismissal in flows: `pressKey: Enter`
  (hideKeyboard is flaky; a keyboard-covered button swallows taps silently).

### forgot-password — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/forgot-password/. All rubric items PASS
  first iteration (heading/description/email field/full-width CTA match).
- Maestro flows/forgot-password.yaml PASS (client-side email validation).
- OTP email path goes to local Mailpit only; exercised in update-password QA.

### update-password — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/update-password/. All rubric items PASS
  after one fix-forward: per-side border utilities (border-y/-l/-r) don't
  materialize under react-native-css — the OTP strip now draws one bordered
  rounded container with per-slot right separators (same joined-box look).
- New primitives: input-otp (invisible TextInput owning the value behind six
  projected slots), alert.
- Maestro flows/update-password.yaml: renders; submit gated on 6-digit OTP;
  zod password-length error surfaces. PASS.
- INCIDENT + boundary (logged per autonomy protocol): one reset-password
  edge-function call was made for the local test user before confirming the
  local edge runtime carries a real RESEND_API_KEY — i.e. it attempted ONE
  real Resend send to `native-goal-test@handicappin.local` (unroutable TLD;
  bounces inside Resend; no human inbox exists for it). No further OTP email
  triggers will be made; the email loop is explicitly OUT of scope (handoff
  §7b) and these screens are ported for structure. The OTP row in
  otp_verifications expires in 15 minutes; only its hash is stored.

### verify-signup — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/verify-signup/. All rubric items PASS
  (3–3 OTP groups with separator, hint, resend link, tip alert; web's
  separator glyph is a middot vs native dash — below finding threshold).
- Maestro flows/verify-signup.yaml PASS against the REAL verify-signup-otp
  edge function: prefilled email via deep link (percent-encoded @), wrong
  code surfaces the backend's "No pending verification found for this
  email" in the destructive alert. No resend tap (it would email).
- Fix recorded: native screens persist across deep links (unlike web full
  page loads) — ?email= now syncs via effect, not just useState initializer.

### verify-email — PASS (in-band judgment vs design language, 2026-06-10)

- Web twin is a SERVER REDIRECT HANDLER (no stable visual): rubric scores
  the native states against the auth-cluster design language (documented in
  the rubric header). Native failed-state captured via invalid ?code= deep
  link: H1 + muted body + primary Back to Login — consistent with cluster.
- Code path mirrors web: exchangeCodeForSession → profile.verified=true →
  /login?verified=true; missing code → /login. Email loop out of scope.

### auth/verify-session — PASS (in-band judgment vs design language, 2026-06-10)

- Web twin redirects logged-out visitors server-side and its in-session
  states depend on live JWT-hook timing — same design-language rubric basis.
- Native mirrors the web state machine exactly (3 refresh retries for
  billing claims → onboarding/returnTo; failed → logout + retry buttons).
  Logged-out Redirect to /login?error=session_expired verified by code
  review; live session states exercised in the auth round-trip era.

### Auth cluster wrap (2026-06-10)

All 7 auth routes ported and removed from INTENTIONAL.webOnly (15 entries
remain). Typed-route forward casts swept — only `/onboarding` (next
cluster) and verify-session's dynamic returnTo remain, marked with
`typed-routes-forward-cast` comments. Full gate set green: native tsc,
expo lint, parity (routes+styles+theme-drift), verify:harness 55/55,
expo export -p ios.

### D10 — Onboarding plan CTAs are mocked; plan-holders redirect home (2026-06-10)

Web's free-plan selection runs a Next SERVER ACTION (createFreeTier
Subscription) and paid plans go to Stripe Checkout — neither is callable
from native. Per the decision ledger (purchase flows mocked), every plan CTA
on native surfaces a clearly-labelled dev notice pointing at the website;
promo-slot data on the lifetime card is REAL (stripe.getPromoSlots tRPC,
verified against the test-mode Stripe key sk_test_…). Web redirects
plan-holders to /billing (permanently web-only) — native sends them to home
instead. Real plan selection for the native flow arrives with RevenueCat.

### onboarding — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/onboarding/ (both sides signed in as
  the test user — agent-browser cookie login on web). All rubric items PASS:
  heading/lead centered, stacked plan cards with check/cross features,
  outline Start Free, badges.
- LIVE positive login path proven en route: Maestro login as
  native-goal-test@handicappin.local → real Supabase session → JWT billing
  claims (plan null) → routed to /onboarding, which rendered with real
  promo-slot data. (This is the first half of the auth round-trip flow.)
- Maestro flows/onboarding.yaml PASS (cards render; mocked CTA surfaces the
  dev notice).

### D11 — ScrollView container styling: ONE style object, never className+style mixed (2026-06-10)

Owner feedback caught content running to the screen edge: passing
`contentContainerClassName` and an inline `contentContainerStyle` together
makes the inline object clobber the className-derived padding under
NativeWind/react-native-css. Rule going forward: scroll-container styling
lives in a single `contentContainerStyle` object fed from `tokens.spacing`
(safe-area insets are runtime values anyway). AuthFormShell + onboarding
fixed and re-verified on-sim; gutters now mirror web (PageContainer px-md,
auth shell px-lg).

### D12 — Web fix: getComprehensiveUserAccess takes the request's Supabase client (2026-06-10)

Seeding rounds through the REAL write path exposed a web bug for bearer
(native) clients: `getComprehensiveUserAccess` built its own COOKIE client,
so bearer-authenticated requests read the profile as anon, RLS hid the row,
and every native write was rejected as plan-less. The function now accepts
an optional request-scoped client; the three tRPC callers (round, scorecard,
stats) pass `ctx.supabase`. Pages/middleware keep the cookie default. Web
gates after the change: tsc clean, eslint clean, ALL 506 web tests pass
(build verified in the end-of-goal gate run).

### D13 — RN layout gotchas catalogued from the home port (2026-06-10)

- Arbitrary-value classes (`basis-[45%]`) do not compile under
  react-native-css → grid geometry goes in a style object
  (flexBasis/flexGrow), carried by a plain View wrapper (Pressable ignores
  style-prop flexBasis).
- `flex-1`'s implicit `flexBasis: 0` defeats wrap-grids — never combine it
  with percentage bases.
- Badge needs `variant="outline"` under tint-* recipes or the default
  variant's `bg-primary` wins the cascade.
- Test data: scripts/seed-native-test-rounds.mjs (real sign-in → reference
  data read as that user → round.submitScorecard through the live web
  server). Test user now: free plan (selected through the real web
  onboarding flow), 3 approved rounds at St. Andrews Old Course.

### home ("" / index) — PASS (in-band judgment, 2026-06-10)

- Captures: /tmp/handicappin-compare/index/ (+ scrolled pairs). Judged vs
  signed-in web at phone width: hero (gradient via expo-linear-gradient from
  token alphas — out-of-contract per §4), welcome header, count-up handicap
  figure, stacked CTAs, 2×2 stat grid with identical REAL values (54 / 10.8
  / +18 / 3), Recent Activity timeline (3 seeded rounds, Best + First round!
  badges, View All), 2-up quick actions, Journey to Scratch, At a Glance.
  All four rubric items PASS after three fix-forward iterations (CTA
  stacking at phone width, Best badge variant, quick-action grid geometry).
- Charts section: desktop-only on web (`hidden md:block`) — correctly absent
  from both phone surfaces.
- Maestro flows/home.yaml PASS (hero → activity → goal → glance with real
  data). Token gallery retired to __gallery (INTENTIONAL.nativeOnly) with
  its rubric; SMOKE_SCREEN now __gallery.
- Tab shell landed ((tabs)/_layout.tsx): Home tab live; Rounds/Statistics/
  Profile tabs register as their screens port (D5 mapping).

## Waivers

(none yet)

## Deferred

- Google OAuth on native: attempt after email/password auth works end-to-end;
  if the `expo-auth-session` web flow against Supabase isn't straightforward,
  ship email/password and log here (handoff §7.2 allows this explicitly).
- Android session-storage adapter (see D3).
- Real RevenueCat SDK (ledger: later milestone; seam is `lib/billing/index.ts`).
