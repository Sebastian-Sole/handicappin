---
name: e2e-testing
description: "Fires when writing, debugging, or maintaining Playwright E2E tests. Also fires when configuring CI/CD for E2E, managing test artifacts, or handling flaky tests."
---

# E2E Testing Patterns

Playwright patterns for stable, fast, and maintainable E2E test suites for this Next.js + Supabase + Stripe app.

> **Status:** Playwright is not yet installed in this repo. When it is, E2E specs go in `e2e/` at the project root, and the commands in this file assume that layout. See CLAUDE.md for test directory conventions.

## User Test Framework

Pre-compiled context files in `references/user-test-contexts/` are the authoritative source per user-test task. Each context file contains:

- Task ID (e.g. `C-1` for customer tasks, `A-1` for admin tasks), persona reference, starting route, evaluator focus
- Accessibility assertions mapped to WCAG success criteria
- UI strings (labels, button text, status messages) for semantic selector matching
- Seed data references and error recovery scenarios
- Journey position and cross-surface verification points

Three testing modes are documented in `references/testing-modes.md`:
1. **Scripted E2E** — Playwright with semantic selectors and requirement annotations
2. **Agentic** — agent-browser with persona behavioral prompts for discoverability testing
3. **Accessibility** — keyboard-only, reflow-320, forced-colors projects + axe-core + custom assertions

Personas in `references/personas/` define device mappings, behavioral prompts, and mechanical constraints for each test population (first-time visitor, returning golfer, admin moderator, mobile-only, screen-reader user).

## Selector Strategy

Use semantic, user-facing selectors. This is the Playwright team's official recommendation and enforces accessibility by design.

```typescript
// Preferred — role-based
await page.getByRole("button", { name: /submit round/i }).click();
await page.getByRole("searchbox", { name: /search courses/i }).fill("Pebble Beach");
await page.getByRole("heading", { name: /handicap index/i });

// Good — label-based for forms
await page.getByLabel("Email").fill("golfer@example.com");
await page.getByLabel("Tee").selectOption("Blue");
await page.getByLabel("Adjusted gross score").fill("82");

// Good — text for non-interactive content
await page.getByText(/awaiting approval/i);

// Last resort — only when no accessible role exists
await page.getByTestId("handicap-trend-chart");
```

**If you can't find an element by role, the UI likely has an accessibility problem.** Fix the component rather than falling back to test IDs.

## Accessibility: Required for Every Flow

Every new page or flow MUST include an axe-core scan. Wire up a custom fixture in `e2e/a11y-test.ts` that exposes `makeAxeBuilder()` pre-configured for WCAG 2.1 AA.

```typescript
import { test, expect } from "./a11y-test";

test("dashboard has no a11y violations", async ({ page, makeAxeBuilder }) => {
  await page.goto("/dashboard");
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});
```

Import accessibility helpers from `e2e/a11y-assertions.ts` for checks axe-core cannot catch:

| Helper | WCAG SC | What it catches |
|--------|---------|-----------------|
| `assertAriaLive` | 4.1.3 | Missing status announcements (round submitted, approval decided) |
| `assertFocusAfterNavigation` | 2.4.3 | Focus lost after route changes |
| `assertSkipLink` | 2.4.1 | Missing skip-to-content link |
| `assertTouchTarget` | 2.5.5 | Touch targets below 44px (critical on the round-entry form) |
| `assertForcedColorsVisible` | 2.4.7 | Focus indicators invisible in high contrast |
| `assertLangAttribute` | 3.1.1 | Missing or wrong `lang` attribute |

## Conventions

### Requirement Annotations

Link tests to requirements (ticket IDs, plan files, or task IDs) via annotations:

```typescript
test("user can submit a round", async ({ page }) => {
  test.info().annotations.push({
    type: "requirement",
    description: "C-3 / plans/tee-course-approval-workflow.md",
  });
  // test body...
});
```

Consult the task's context file in `references/user-test-contexts/` for which requirements apply.

### axe-core in Every Test File

Every test file should import from `a11y-test` and include at least one axe-core scan:

```typescript
import { test, expect } from "./a11y-test";
```

## Page Object Model (POM)

Encapsulate page interactions for complex flows. Use semantic locators inside POMs.

```typescript
import { type Page, type Locator } from "@playwright/test";

export class RoundEntryPage {
  readonly page: Page;
  readonly courseInput: Locator;
  readonly teeSelect: Locator;
  readonly scoreInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.courseInput = page.getByRole("combobox", { name: /course/i });
    this.teeSelect = page.getByLabel(/tee/i);
    this.scoreInput = page.getByLabel(/adjusted gross score/i);
    this.submitButton = page.getByRole("button", { name: /submit round/i });
  }

  async goto() {
    await this.page.goto("/rounds/new");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async submit({ course, tee, score }: { course: string; tee: string; score: number }) {
    await this.courseInput.fill(course);
    await this.page.getByRole("option", { name: new RegExp(course, "i") }).click();
    await this.teeSelect.selectOption(tee);
    await this.scoreInput.fill(String(score));
    await this.submitButton.click();
  }
}
```

## Test Structure

```typescript
import { test, expect } from "./a11y-test";
import { RoundEntryPage } from "./pages/round-entry-page";

test.describe("Round submission", () => {
  let roundEntry: RoundEntryPage;

  test.beforeEach(async ({ page }) => {
    roundEntry = new RoundEntryPage(page);
    await roundEntry.goto();
  });

  test("submits a round and shows pending status", async ({ page }) => {
    await roundEntry.submit({ course: "Pebble Beach", tee: "Blue", score: 82 });

    await expect(page.getByRole("status")).toContainText(/awaiting approval/i);
    await expect(page).toHaveURL(/\/rounds\//);
  });

  test("shows validation error for missing course", async ({ page }) => {
    await page.getByRole("button", { name: /submit round/i }).click();

    await expect(page.getByText(/course is required/i)).toBeVisible();
  });

  test("round-entry page is accessible", async ({ page, makeAxeBuilder }) => {
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});
```

## Waiting Strategies (Avoid Flakiness)

Never use arbitrary timeouts. Wait for specific conditions.

```typescript
// Bad — arbitrary timeout, slow and flaky
await page.waitForTimeout(5000);

// Good — wait for tRPC/API response
await page.waitForResponse(resp => resp.url().includes("/api/trpc/rounds.create"));

// Good — wait for element state
await expect(page.getByRole("list", { name: /rounds/i })).toBeVisible();
await page.getByRole("button", { name: /approve/i }).waitFor({ state: "visible" });

// Good — wait for navigation
await page.waitForURL("**/dashboard");

// Good — wait for DOM ready after dynamic content
await page.waitForLoadState("domcontentloaded");
```

## Flaky Test Patterns

### Quarantine

```typescript
test("subscription upgrade with 3DS challenge", async ({ page }) => {
  test.fixme(true, "Flaky — Stripe test-mode 3DS race, issue #123");
  // test code...
});

test("webhook-driven approval notification", async ({ page }) => {
  test.skip(process.env.CI === "true", "Flaky in CI — depends on Stripe CLI forwarder");
  // test code...
});
```

### Diagnosing Flakiness

```bash
# Repeat a specific test to check for flakiness
pnpm exec playwright test e2e/rounds.spec.ts --repeat-each=10

# Run with retries to see which tests are flaky
pnpm exec playwright test --retries=3
```

### Common Causes & Fixes

**Race conditions:**
```typescript
// Bad — element might not be ready
await page.click('[data-testid="submit"]');

// Good — auto-waiting locator
await page.getByRole("button", { name: /submit/i }).click();
```

**Animation timing:**
```typescript
const menuItem = page.getByRole("menuitem", { name: /settings/i });
await menuItem.waitFor({ state: "visible" });
await menuItem.click();
```

**Stripe checkout redirects:**
```typescript
// Stripe test mode redirects to checkout.stripe.com — wait for the hosted page
const [checkoutPage] = await Promise.all([
  context.waitForEvent("page"),
  page.getByRole("button", { name: /upgrade/i }).click(),
]);
await checkoutPage.waitForURL(/checkout\.stripe\.com/);
```

## Artifact Management

### Screenshots

```typescript
// On failure (configured in playwright.config — automatic)
// Manual screenshots for debugging:
await page.screenshot({ path: "artifacts/after-submit.png" });
await page.screenshot({ path: "artifacts/full-page.png", fullPage: true });
```

### Traces

Traces are captured on first retry by default (configured in playwright.config). View with:

```bash
pnpm exec playwright show-trace trace.zip
```

## Services Required Locally

E2E tests that exercise the full stack need the same processes as `pnpm dev:all`:

| Service | URL | When it matters |
|---------|-----|-----------------|
| Next.js | `http://localhost:3000` | Always |
| Stripe CLI listener | forwards to `/api/stripe/webhook` | Subscription/upgrade flows |
| Supabase local | default ports | Integration tests and seeded E2E |

CI should start the Next.js server and stub or record Stripe/Supabase calls as appropriate — don't rely on a developer machine being up.

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm exec playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## This Skill IS / IS NOT

- **IS**: Playwright E2E testing patterns, Page Object Model, CI/CD, artifact management, flaky test strategies
- **IS NOT**: Regression testing strategy — see `ai-regression-testing` for AI-specific blind spots
- **IS NOT**: Unit/component testing patterns — see `tdd-workflow` for Vitest + Testing Library

## Gotchas

- **Playwright isn't installed yet.** Before writing E2E specs, install it and scaffold `e2e/`, `playwright.config.ts`, `e2e/a11y-test.ts`, and `e2e/a11y-assertions.ts`. Don't assume any of this exists.
- **Context files are the source of truth.** When writing tests for a specific task, always read the context file in `references/user-test-contexts/` first — it has the routes, seed data, and evaluator focus you need.
- **axe-core misses dynamic content.** Run scans after interactions (form submit, modal open, approval decision), not just on initial page load.
- **Auth state must be seeded per test project.** Use `storageState` to authenticate as a customer, admin, or anonymous visitor. Admin-only tasks (approve/reject submissions) won't even render for unauthenticated sessions.
- **Always import from `./a11y-test`, not `@playwright/test`.** The custom fixture provides `makeAxeBuilder()` pre-configured for WCAG 2.1 AA.
- **`networkidle` is unreliable with Sentry/analytics beacons.** Prefer `waitForResponse` for tRPC calls or `waitForURL` for specific conditions.
- **`getByRole` failures often indicate a11y problems.** Fix the component's semantics rather than falling back to `getByTestId`.
- **Stripe webhooks are async.** Don't assert on subscription state immediately after checkout — wait for the tRPC query to re-fetch, or poll the subscription endpoint.
- **Supabase RLS applies in tests too.** A test authenticated as user A cannot read user B's rounds — use the service-role seeder from outside the browser to set up cross-user fixtures.
- **Traces are captured on first retry.** Configure retries in `playwright.config.ts` to get automatic trace artifacts on failure.

## Cross-References

- **TDD workflow**: See `tdd-workflow` skill for when to write E2E tests vs unit tests
- **Manual a11y testing**: See `keyboard-test` and `screen-reader-test` skills
- **Regression testing**: See `ai-regression-testing` skill for catching AI-introduced bugs
- **User test contexts**: `references/user-test-contexts/` — authoritative source per task
- **Testing modes**: `references/testing-modes.md` — scripted, agentic, accessibility patterns
- **Personas**: `references/personas/` — behavioral prompts and device constraints
- **A11y assertions**: `e2e/a11y-assertions.ts` — custom WCAG assertion helpers (to be created)
