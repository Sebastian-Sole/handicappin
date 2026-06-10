# scripts/parity — web↔native parity tooling

Ported from the ks-digital reference implementation. Full spec: `docs/web-native-parity.md`.

All gates are **dormant** until `apps/native` exists — they detect its absence, print an informational note, and exit 0. The day the native app lands they arm automatically; nothing needs rewiring.

| Script | What | Gate? |
|---|---|---|
| `routes.mjs` (`pnpm parity:routes`) | Auto-discovers routes from both file routers (web: `app/**/page.tsx`, native: `apps/native/app/**`), strips `(groups)`, intersects. Fails on undeclared divergence; deliberate divergences live in the `INTENTIONAL` sets in this file (intent, not a mapping). | HARD (pre-commit) |
| `drift.mjs` (`pnpm parity:drift [baseRef]`) | Hand-rolled import-graph closure (`@/` → repo root): changed web UI file → which route pages transitively render it → which same-slug native screens need mirroring. | advisory (hook/CI signal) |
| `watch.mjs` (`pnpm parity:watch`) | Live dev watcher over `components/ app/ lib/ hooks/ contexts/` — prints affected routes on every save (human twin of the agent hook). | signal |
| `check-hardcoded-styles.mjs` (`pnpm parity:styles`) | Scans `apps/native/{components,app,lib}` for hex/rgb/spacing/radius/font/shadow literals; everything must come from `@handicappin/tokens`. Escape hatch: `// allow-hardcoded <reason>`. | HARD (pre-commit) |

`pnpm parity` = theme-drift + routes + native styles in one shot.

Design principles (why there is no mapping file):
- **Routes are the join key.** Both routers are file-based; slugs must match anyway. A rename on one side falls out of the intersection and fails loudly instead of a `// counterpart:` comment rotting silently.
- **Affected screens are computed** from the import graph, never declared.
- **Token values flow through the generator** (`pnpm generate:theme`); these scripts only police what can't be generated — component structure and native styling discipline.

Native bring-up checklist lives in `docs/web-native-parity.md`.
