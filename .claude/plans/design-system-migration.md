# Design System Migration Playbook

Reusable migration plan for moving components off raw Tailwind color utilities and raw HTML heading tags onto the project's semantic design tokens and Typography primitives.

## How to use this playbook

This file is a parameterized prompt. Every agent session migrates one "cluster" — usually a single directory under `components/` or a single route under `app/`.

**Default pattern: parallel execution across all clusters in one go.** See the Orchestration section at the bottom of this file — it's the starting point. Sequential execution is for when a single cluster needs human judgment before the rest proceed (e.g., resolving ambiguous tokens surfaced by an earlier run).

**For a single cluster (special cases):**

1. Decide the target directory (e.g. `components/statistics/**`)
2. Run a Claude prompt that either:
   - Pastes this entire file's contents with `{TARGET_DIRECTORY}` replaced by the cluster, or
   - References it: `Follow @.claude/plans/design-system-migration.md with TARGET_DIRECTORY = components/statistics/**`
3. Review the report, resolve ambiguous mappings, commit follow-ups if needed

---

## Mission

Migrate every `.tsx` file in `{TARGET_DIRECTORY}` off raw Tailwind color utilities and raw HTML heading tags onto the project's semantic design tokens and Typography primitives. This is part of an incremental migration — visual regressions at token boundaries are acceptable (the modernization pass will tune values later); layout breakage is not.

## Required reading before writing any code

1. `CLAUDE.md`
2. `.claude/rules/coding-standards.md`
3. `.claude/rules/general.md`
4. `.claude/rules/logging.md`
5. `app/styles/utilities/typography.css` — the `@utility` directives you'll be using
6. `app/globals.css` — the token definitions (`--color-primary`, `--color-success`, `--color-warning`, `--color-info`, `--color-destructive` and their `-foreground` pairs)
7. `components/ui/typography.tsx` — `H1..H4`, `P`, `Small`, `Muted`, `Lead`, `Large` primitives you can compose
8. `eslint.config.mjs` — find the `RAW_COLOR_GRANDFATHERED` and `RAW_HEADING_GRANDFATHERED` arrays. Files you migrate get removed from these arrays.

## Semantic mapping cheatsheet

Apply these mappings literally unless context demands otherwise. If context is ambiguous, STOP and report — do not guess.

**Color class prefix → semantic token**

| Raw prefix | Semantic token | Typical use |
|---|---|---|
| `*-green-*` | `success` | status: positive, improvement, completion |
| `*-green-*` | `primary` | brand accent, call-to-action |
| `*-red-*` | `destructive` | errors, danger, negative deltas |
| `*-amber-*` | `warning` | caution, approaching limits |
| `*-yellow-*` | `warning` | caution |
| `*-blue-*` | `info` | neutral informational callouts |
| `*-gray-*` | `muted` / `muted-foreground` | de-emphasized text/bg |
| `*-zinc-*` | `muted` / `muted-foreground` | de-emphasized text/bg |
| `*-slate-*` | `muted` / `muted-foreground` | de-emphasized text/bg |
| `*-neutral-*` | `muted` / `muted-foreground` | de-emphasized text/bg |
| `*-stone-*` | `muted` / `muted-foreground` | de-emphasized text/bg |

**Tint depth → token opacity**

| Raw tint | Token |
|---|---|
| `bg-*-50` | `bg-<token>/10` |
| `bg-*-100` | `bg-<token>/20` |
| `bg-*-200` | `bg-<token>/30` |
| `bg-*-500` | `bg-<token>` |
| `bg-*-600` | `bg-<token>` (dominant shade) |
| `bg-*-700` | `bg-<token>` (accept slight darkening for now) |

**Text emphasis**

- `text-*-600` / `text-*-700` → `text-<token>` (for status colors)
- `text-*-foreground` → use the corresponding `-foreground` token

**Headings**

- `<h1 className="...">` → `<H1 className="...">` from `components/ui/typography.tsx`, or `<h1 className="text-heading-1 ...">` if you need the raw element
- Same pattern for `h2..h4`
- For `h5` / `h6`, use `text-body font-semibold` or add the file to `PENDING_AMBIGUOUS.md` and discuss

## Ambiguous cases — STOP and report, do not guess

Add to `PENDING_AMBIGUOUS.md` (scratchpad in repo root; do not commit) and skip the file. Examples:

- A color that reads both brand-y and status-y (e.g., green used for "you earned this" — is it `primary` or `success`?)
- A decorative gradient or accent that has no semantic meaning
- A color scheme not covered by the current tokens (e.g., a purple CTA in one place)
- Any file where removing the raw color would require adding a new token to `globals.css` — adding tokens is out of scope for this task; report instead
- A `h5` / `h6` whose intended type role isn't obvious

## Workflow — per file

1. Read the target file in full
2. Identify every raw color utility and every raw `<h1>-<h6>` tag
3. Apply mappings from the cheatsheet
4. If anything is ambiguous: add the file to `PENDING_AMBIGUOUS.md` with the specific question, skip to next file
5. Remove the file's path from `RAW_COLOR_GRANDFATHERED` and/or `RAW_HEADING_GRANDFATHERED` in `eslint.config.mjs`
6. Run `pnpm lint <file>` — must exit 0 (or only pre-existing warnings)
7. Move to next file

## Workflow — per cluster of ~5 files, or at the end

8. Run `pnpm tsc --noEmit` — must exit 0
9. Run `pnpm build` — must exit 0
10. Run `pnpm vitest run --exclude '**/.claude/worktrees/**' --exclude '**/node_modules/**'` — all must pass
11. Commit. One file per commit for non-trivial changes; small batches of related files in one commit is OK.

**Commit message format:**

```
design: migrate <short description> off raw tokens

- <file 1>
- <file 2>

Grandfather entries removed.
```

## Success criteria — ALL must be true

- [ ] Every `.tsx` file in `{TARGET_DIRECTORY}` uses only semantic tokens for color-bearing Tailwind utilities (no raw `red/green/amber/blue/yellow/orange/pink/purple/gray/zinc/slate/neutral/stone` with a numeric suffix)
- [ ] No raw `<h1>-<h6>` tags remain in `{TARGET_DIRECTORY}` files
- [ ] Every migrated file has been removed from the grandfather lists in `eslint.config.mjs`
- [ ] `pnpm lint` exits 0 (pre-existing warning in `components/scorecard/add-course-dialog.tsx` is allowed)
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm vitest run --exclude '**/.claude/worktrees/**' --exclude '**/node_modules/**'` — all tests pass
- [ ] Each migrated file is in its own commit (or a tight cluster of related files)
- [ ] `PENDING_AMBIGUOUS.md` (if any) lists every file that needs human judgment, with a specific question per file

## Explicit DO NOT

- Do not add new tokens to `globals.css` or new utilities to `utilities/typography.css` (out of scope — raise in `PENDING_AMBIGUOUS.md` if needed)
- Do not refactor component logic, only styling
- Do not add or remove components, change prop shapes, or alter rendered HTML structure (other than `<h*>` → `<H*>` which is expected)
- Do not use `any` or suppress ESLint rules
- Do not touch files outside `{TARGET_DIRECTORY}`, except `eslint.config.mjs` for the grandfather arrays
- Do not skip the per-cluster build / typecheck / test steps
- Do not guess at ambiguous semantic choices
- Do not use `console.log` / `console.error` — use `logger` from `@/lib/logging` per `.claude/rules/logging.md`

## Report format

At the end, produce a report with:

1. **Files migrated** — bulleted list with brief "what changed" per file
2. **Commits made** — hashes + one-line summaries
3. **Ambiguous cases** — reference `PENDING_AMBIGUOUS.md`; for each entry note the file path and the specific question
4. **Patterns worth promoting to primitives** — e.g. "three files all implement a 'stat up/down' indicator — consider a `<StatDelta>` component"
5. **Patterns worth promoting to `@utility`** — e.g. "five files use the same card-with-tint pattern — consider `@utility card-info` in `app/styles/components/cards.css`"
6. **Grandfather-list sizes** — before / after counts for each array

---

## Orchestration — parallel run across the codebase (DEFAULT)

Spawn six agents in one message, each in its own git worktree. They run concurrently and independently. You review and merge after all complete.

### Cluster assignment

| # | Target directories |
|---|---|
| 1 | `components/dashboard/**` + `app/dashboard/**` |
| 2 | `components/round/**` + `app/rounds/**` |
| 3 | `components/calculators/**` + `app/calculators/**` |
| 4 | `components/statistics/**` + `app/statistics/**` |
| 5 | `components/homepage/**` + `app/page.tsx` |
| 6 | `components/profile/**` + `app/profile/**` |

### Deferred clusters (do NOT include in the parallel run)

- `components/billing/**` + `app/billing/**` — has an independent audit pending; migrate after billing hardening lands
- `components/scorecard/**` — partially migrated in the design-system foundation commit; check grandfather arrays first and run as a follow-up only if entries remain

### Agent spawn configuration

For each cluster, spawn an Agent with:

- `subagent_type: "general-purpose"`
- `model: "opus"` — explicit, do not inherit
- `isolation: "worktree"` — required; each agent gets its own worktree
- `run_in_background: true` — you get notifications as each completes
- `description`: short, e.g. `"Migrate dashboard off raw tokens"`
- `prompt`: the contents of this playbook with `{TARGET_DIRECTORY}` substituted

### Pre-flight

Before spawning:

- Confirm you are on `feat/rn-prep` (or whichever branch holds the design-system foundation commit)
- Capture reference screenshots of each cluster's visible pages in both light and dark mode — not for automated regression, but so you can distinguish "intentional token shift" from "I broke the layout" during review
- `pnpm install` to confirm the workspace is hydrated
- `pnpm lint && pnpm build` to confirm the baseline is clean

### After all six agents complete

1. **Review reports.** Each agent returns a report with commits, ambiguous cases, and pattern observations. Consolidate the six `PENDING_AMBIGUOUS.md` files into a single list for resolution.

2. **Merge worktrees into the base branch sequentially, smallest diff first.** For each worktree:
   ```
   git merge worktree-agent-<id> --no-ff -m "Merge <cluster> migration"
   ```
   Expect minor textual conflicts on `eslint.config.mjs` — two agents removing different entries from the same array. Resolve by keeping both deletions.

3. **After each merge:** `pnpm install && pnpm build && pnpm lint` to confirm no regressions. Defer running tests until all six are merged.

4. **After all six are merged:** `pnpm vitest run --exclude '**/.claude/worktrees/**' --exclude '**/node_modules/**'` — all must pass.

5. **Resolve ambiguous cases** from the consolidated `PENDING_AMBIGUOUS.md`. Do this as a single human-driven commit after all six agents are merged so semantic choices stay consistent.

6. **Visual pass.** `pnpm dev`, load each cluster's pages, compare against pre-migration screenshots. Expect minor color shifts at token boundaries (that's the point). Flag anything that looks broken rather than merely different.

7. **Clean up worktrees.** `git worktree remove` for each; `git branch -d` for each merged branch.

### Risk profile

- **eslint.config.mjs conflicts:** guaranteed but trivial (~5 min total).
- **Worktree isolation reliability:** has been inconsistent in prior sessions — occasional agent writes land in the main working tree instead of its worktree. Mitigation: the playbook's strict file-scope discipline limits blast radius; verify via `git status` in the main working tree after each completion.
- **Cost:** six Opus agents running ~20 min each. Known upfront.
- **Inconsistent semantic choices:** agents defer ambiguous cases to `PENDING_AMBIGUOUS.md` rather than guessing, so inconsistency is impossible by design — unresolved choices surface to you.

## When migration is complete

Both grandfather arrays in `eslint.config.mjs` are empty:

```js
const RAW_COLOR_GRANDFATHERED = [];
const RAW_HEADING_GRANDFATHERED = [];
```

At that point, remove the grandfather mechanism from `eslint.config.mjs` entirely — the rule applies to every file unconditionally. Every file uses tokens, every heading uses a primitive or `@utility`. You're then in a position to change token values (modernize the brand) and have the update propagate everywhere in one commit.
