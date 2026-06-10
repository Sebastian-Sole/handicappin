# custom/

One-off CSS for a single page or feature block that cannot be cleanly
expressed via Tailwind utilities or a shared `@utility` directive.

## What goes here

- Page-scoped layout tweaks tied to a specific route.
- Print stylesheets or media queries for one feature.
- Complex composition of pseudo-elements, grid templates, or animations
  that would be noisy in JSX `className` lists.

## What does NOT go here

- Anything reused across multiple components → `app/styles/components/`.
- Anything that should be a design token → `app/globals.css` (`@theme`
  or `:root` / `.dark`).
- Anything expressible in 2-3 Tailwind classes → use `cn()` in the
  component instead.

## Naming

Kebab-case matching the route or feature that owns the style:

- `dashboard-hero.css`
- `scorecard-table-print.css`
- `onboarding-step-indicator.css`

## When to reach for this

After trying, in order:

1. Tailwind utilities via `cn()` on the element.
2. Composition of existing shadcn primitives.
3. A new reusable `@utility` in `app/styles/utilities/`.
4. A shared component stylesheet in `app/styles/components/`.

Only then drop into `custom/`. Each file added here should be
registered as an `@import` at the bottom of `app/globals.css`.
