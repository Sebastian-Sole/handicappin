---
name: web-native-parity
description: "Fires when changing design tokens or utility recipes (app/globals.css, app/styles/utilities/*), changing a web component or screen once apps/native exists, porting UI between web and native, or asked how web↔native parity/sync works. Supplies the port-and-verify playbook that keeps the native app 1:1 with web."
user-invocable: true
---

# Web → Native Parity (port & verify)

The web app (repo root) is the design source of truth. The native app (`apps/native`, once it exists) is a **separate** component implementation that must stay 1:1. One design system (tokens), two component libraries. Full reference: `docs/web-native-parity.md`. Binding rule: `.claude/rules/web-native-parity.md`.

## Decide which kind of change you made

**A design VALUE (color/spacing/radius/shadow/typography/surface recipe)** → it lives in `app/globals.css` or `app/styles/utilities/{typography,surfaces}.css`. Change it there, then:

```bash
pnpm generate:theme        # regenerates packages/tokens/generated/*
```

Native updates with **zero native edits** (the pre-commit hook regenerates automatically too). Do NOT hand-edit `packages/tokens/generated/*` or hardcode the value in native code.

**A COMPONENT (layout / structure / which token it uses)** → there is NO generator for this (web JSX ≠ RN JSX). Once `apps/native` exists you MUST mirror it:

1. **Find which native screens are affected** (computed, not guessed):
   ```bash
   pnpm parity:drift          # changed web files → affected route slugs
   ```
2. **Edit the same-slug native screen/component** in `apps/native/` to match. Native styling must come from the generated contract only:
   - colors → `tokens.colors.light/dark[...]` from `@handicappin/tokens/tokens`
   - spacing → `tokens.spacing.md` (semantic ramp) or `tokens.spacingScale['4']`
   - radii → `tokens.radii.*`; shadows → `tokens.shadows.*` (structured layers)
   - typography → generated `className="text-*"` (same names as web: `text-heading-2`, `text-figure-lg`, …)
   - surfaces → generated `className="tint-success"` etc. (same names as web) or `tokens.surfaces.light/dark[...]`
3. **Run the gate**: `pnpm parity` (theme-drift + route match + no hardcoded native values). Must pass before merge.

**A ROUTE (rename/add)** → `pnpm parity:routes` fails until the slug matches on both apps, or the divergence is declared in `INTENTIONAL` (`scripts/parity/routes.mjs`).

During interactive dev, `pnpm parity:watch` prints affected routes on every web UI save.

## Gotchas

- **Phase-1 dormancy.** `apps/native` does not exist yet; `parity:routes`/`parity:styles`/the drift gate detect that and exit 0 with a note. Don't "fix" the dormancy — it arms itself when the app lands. The token pipeline (`generate:theme`, `check:theme-drift`, `check:tokens`) is fully live NOW.
- **Only the token sources are generated → native.** `generate:theme` reads `app/globals.css` + the two utility files (`theme.config.json` lists them). Editing a web *component* changes nothing in native automatically.
- **A value with no token isn't an excuse to hardcode.** Add it to `globals.css` `@theme` (or the typography/surfaces layer) and regenerate — then consume the token. `// allow-hardcoded <reason>` is only for genuinely token-less values.
- **Gradients are out of contract.** `hero-gradient`/`hero-radial` are skipped by the generator (RN needs expo-linear-gradient) — the generator prints every skipped utility on each run; check that list before assuming something propagated.
- **Surfaces are per-mode.** `color-mix` recipes resolve differently for light/dark; on native use the generated class names (mode-aware via `:root`/`.dark` vars) rather than copying a single hex.
- **Dark mode strategy needs validation at native bring-up.** The generated `native-global.css` uses `.dark`-scoped vars + `@custom-variant dark`; confirm against a real NativeWind v5 build before trusting it (tracked in `docs/web-native-parity.md`).
- **Don't assume the native file has the same name.** Route slugs are the join key (`parity:drift` is route-keyed); native components may be split differently.
- **`@handicappin/handicap-core` is single-source** for USGA calculation logic; both apps import it. Never duplicate calc logic into native.
