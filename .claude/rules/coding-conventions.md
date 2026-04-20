# Coding Conventions

Hard rules for this codebase. Follow without exception. See `package.json` for exact script names.

## Linting & Formatting

- **ESLint** is the linter. Config is flat-config in `eslint.config.mjs` extending `eslint-config-next`.
- Do not add Biome, XO, or alternative linters. Do not add a second formatter.
- Run `pnpm lint` before committing. Fix all errors.
- Prettier is available as a dev dependency but no project-wide formatting script exists — rely on `eslint-config-next`'s style rules and editor integration.

## TypeScript

- **Strict mode** is on (`tsconfig.json`). Do not weaken it.
- No `any`. Use `unknown` and narrow with type guards or `zod` parsing.
- No `enum`. Use `as const` objects or union types.
- Prefer `interface` for object shapes, `type` for unions and intersections.
- Use the `@/` path alias for imports from the project root (e.g. `@/lib/...`, `@/components/...`, `@/server/...`, `@/db/...`, `@/trpc/...`). No deep relative imports (`../../../`).
- Generated Supabase types live in `types/supabase.ts`. Regenerate with `pnpm gen:types` (remote) or `pnpm gen:local` (local stack). Do not hand-edit.
- Validate anything that crosses a trust boundary (route params, form data, external API responses, webhook payloads) with `zod`. Pair Drizzle schemas with `drizzle-zod`.

## Next.js (App Router, v16 + Turbopack, React 19)

- **Server Components by default.** Add `"use client"` only when the component needs hooks, event handlers, browser APIs, or context.
- Fetch data in Server Components when possible. On the client, fetch via tRPC + React Query (`@/trpc`). Do not use `useEffect` to fetch data the server could provide.
- **Mutations go through tRPC.** Do not add Next.js API routes for CRUD that tRPC already covers. Route handlers in `app/api/` are reserved for webhooks (Stripe), OAuth callbacks, and cases tRPC can't serve.
- Server Actions are acceptable for form-only flows, but prefer tRPC for anything that's also called from the client.
- `instrumentation.ts` and `instrumentation-client.ts` wire Sentry — don't break them.
- Keep route components thin. Push logic into `@/server/...` or `@/lib/...`.

## Data Layer

- **Drizzle ORM** against Supabase Postgres. Schema lives in `db/`. Drizzle config in `drizzle.config.ts`.
- All DB access from server-side code only (`server/`, `app/api/`, Server Components, tRPC procedures). Never import `db/` from a client component.
- **Supabase**: use `@supabase/ssr` clients. Respect RLS — do not use the service role client outside clearly-scoped server utilities. When you do use it, justify in the PR.
- Cross-check schema drift with `pnpm check:schema-sync` when touching migrations or the schema.

## State & Forms

- Server state: tRPC + React Query. No Zustand, no Redux.
- Client-only UI state: `useState` / `useReducer`. Lift to context only when needed (`contexts/`).
- Forms: `react-hook-form` + `@hookform/resolvers/zod` with a shared `zod` schema between client and server.

## Styling & UI

- **Tailwind CSS v4** utility classes. No custom CSS modules, no styled-components.
- Component variants via `class-variance-authority` (CVA). Merge classes with `cn()` from `@/lib/utils` (which wraps `clsx` + `tailwind-merge`).
- UI primitives are shadcn/ui on top of Radix UI. Component registry config is `components.json`; primitives live in `components/ui/`. Prefer composing existing primitives over pulling in new ones.
- Design tokens live in `app/globals.css`.

## Accessibility (WCAG 2.1 AA)

- Semantic HTML (`<nav>`, `<main>`, `<article>`, `<button>`) — no `<div onClick>`.
- Keyboard accessibility on every interactive element; visible focus indicators.
- ARIA only when semantic HTML is insufficient.
- Contrast minimums: 4.5:1 normal text, 3:1 large text.
- Every `<img>` has `alt` (use `alt=""` for decorative).
- Form inputs have associated `<label>`.
- The `a11y-check.sh` hook runs `eslint-plugin-jsx-a11y` on every TSX edit; don't suppress its findings.

## Payments, Auth, Email, Observability

- **Stripe**: pin the API version used in `lib/stripe/...` (or equivalent). Webhook handlers must verify signatures and be idempotent (dedupe by event ID). Never log full event payloads or PII.
- **Auth**: Supabase Auth via `@supabase/ssr`. Server-side session reads happen in `server/` or middleware (`proxy.ts`). Never trust `auth.uid()` on the client for authorization decisions.
- **Email**: React Email templates in `emails/`. Send via Resend from server code only. Preview locally with `pnpm email`.
- **Observability**: Sentry is wired through the two instrumentation files and `sentry.*.config.ts`. Don't `console.log` in shipped code — use Sentry breadcrumbs or structured logging. The Stop hook audits for stray `console.log`.
- **Rate limiting**: `@upstash/ratelimit` + `@upstash/redis`. Apply to public endpoints (auth, contact forms, webhooks reachable without auth).
- **Environment**: `env.ts` (`@t3-oss/env-nextjs`) is the single source of truth for env vars. Don't reach into `process.env` directly in app code.

## Testing

- **Vitest** with three entrypoints: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`.
- Unit tests live in `tests/unit/` (and legacy `test/unit/`). Integration tests in `tests/integration/`.
- Integration tests may hit a real local Supabase — don't mock the database for them.
- E2E tests (when introduced) use Playwright under `e2e/`. See `.claude/skills/e2e-testing/`.

## File Organization

| Directory | Purpose |
|---|---|
| `app/` | Next.js App Router routes, layouts, route handlers |
| `components/` | Shared components; `components/ui/` is shadcn primitives |
| `server/` | tRPC routers, server-only business logic |
| `trpc/` | tRPC client/provider wiring |
| `db/` | Drizzle schema and query helpers |
| `lib/` | Framework-agnostic utilities (`cn`, formatters, clients) |
| `hooks/` | React hooks (application-level) |
| `contexts/` | React context providers |
| `emails/` | React Email templates |
| `supabase/` | Migrations, edge functions, seeds |
| `types/` | Shared types; `supabase.ts` is generated |
| `tests/` | `unit/`, `integration/` |
| `scripts/` | One-off `tsx`/node scripts |

## Package Manager

- **pnpm only**. `pnpm-lock.yaml` is authoritative. Do not commit `package-lock.json` or `yarn.lock`.
- One-off TS scripts run via `tsx` (see `scripts/`).
