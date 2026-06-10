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

## Waivers

(none yet)

## Deferred

- Google OAuth on native: attempt after email/password auth works end-to-end;
  if the `expo-auth-session` web flow against Supabase isn't straightforward,
  ship email/password and log here (handoff §7.2 allows this explicitly).
- Android session-storage adapter (see D3).
- Real RevenueCat SDK (ledger: later milestone; seam is `lib/billing/index.ts`).
