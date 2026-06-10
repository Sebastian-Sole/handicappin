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

## Waivers

(none yet)

## Deferred

- Google OAuth on native: attempt after email/password auth works end-to-end;
  if the `expo-auth-session` web flow against Supabase isn't straightforward,
  ship email/password and log here (handoff §7.2 allows this explicitly).
- Android session-storage adapter (see D3).
- Real RevenueCat SDK (ledger: later milestone; seam is `lib/billing/index.ts`).
