# Web ↔ Native Parity

The web app (repo root: `app/`, `components/`, `lib/`) is the **design source of truth**. The native app (`apps/native`, once it exists) is a **separate component implementation** that must stay 1:1 with web. There is ONE design system (tokens), not two — but two component libraries that both consume it.

Status: the native app does not exist yet. The token contract and all gates below are live; the native-side gates are dormant and arm automatically when `apps/native` lands. Until then the binding requirement is: keep the token discipline (no bypasses) so generation stays one-to-one.

## What is automatic (do not hand-maintain)

- **Design tokens** (colors light+dark, radii, semantic spacing, sizes, breakpoints, tracking, shadows, typography ramp, surface/tint/chip recipes) are GENERATED from `app/globals.css` + `app/styles/utilities/*` into `packages/tokens/generated/` (`pnpm generate:theme`; pre-commit auto-regenerates). Never hand-edit generated files or hardcode token values in native code.
- **Routes** are auto-discovered from both file-based routers and intersected by `pnpm parity:routes`. Do not maintain a screen list.
- **Affected screens** on a web change are computed from the import graph by `pnpm parity:drift`. Do not maintain a web↔native file map.

## The binding requirement (once apps/native exists)

When you change a **web component or screen** (`components/**`, `app/**`, `lib/**`):

1. The change is design source-of-truth. Update the **same-slug native screen/component** in `apps/native/` to match — component STRUCTURE does not auto-propagate (only token VALUES do).
2. Run `pnpm parity:drift` to see exactly which routes your change affects.
3. Native styling must come from `@handicappin/tokens` / the generated NativeWind classes — never hardcoded hex/rgba/px/font literals (`pnpm parity:styles` blocks them; `// allow-hardcoded <reason>` is the only escape hatch).

When you rename or add a **route**, `pnpm parity:routes` fails until the route matches on both apps or is declared in `INTENTIONAL` (`scripts/parity/routes.mjs`). Do not bypass it.

## Enforcement layers
- `pnpm check:tokens` — web styling that bypasses tokens. HARD (pre-commit).
- `pnpm check:theme-drift` — stale generated contract. HARD (pre-commit regen + CI `theme-drift.yml`).
- `pnpm parity:routes` — route divergence. HARD (pre-commit; dormant until native exists).
- `pnpm parity:styles` — hardcoded native styling. HARD (pre-commit; dormant until native exists).
- `pnpm parity:drift` — changed web file → affected native screens. Advisory (PostToolUse hook + `pnpm parity:watch`).
