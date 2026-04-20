# Testing Modes

Three complementary testing modes, each catching different categories of issues. Every feature gets Mode 1 and Mode 3. Mode 2 runs after implementation to evaluate discoverability.

---

## Mode 1: Scripted E2E (Playwright)

**When:** Every feature, every task. The baseline.

**Tool:** Playwright with project selection based on persona device (desktop/mobile).

**Patterns:**

### Fixture and Imports

Import the a11y fixture for WCAG scanning:

```typescript
import { test, expect } from "../a11y-test";
```

### Page Object Model

Use POM for complex flows to keep tests readable and maintainable:

```typescript
class RoundEntryPage {
  constructor(private page: Page) {}

  async submit({ course, tee, score }: { course: string; tee: string; score: number }) {
    await this.page.getByRole("combobox", { name: /course/i }).fill(course);
    await this.page.getByRole("option", { name: new RegExp(course, "i") }).click();
    await this.page.getByLabel(/tee/i).selectOption(tee);
    await this.page.getByLabel(/adjusted gross score/i).fill(String(score));
    await this.page.getByRole("button", { name: /submit round/i }).click();
  }

  get rounds() {
    return this.page.getByRole("list", { name: /rounds/i });
  }
}
```

### Semantic Selectors

Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors. This tests accessibility for free:

```typescript
// Good
await page.getByRole("button", { name: /submit round/i }).click();

// Avoid
await page.locator(".btn-primary").click();
```

### Requirement Annotations

Link tests to requirements (task IDs, plan files, or tickets) using annotations:

```typescript
test("user can submit a round", async ({ page }) => {
  test.info().annotations.push({
    type: "requirement",
    description: "C-3 / plans/tee-course-approval-workflow.md",
  });
  // test body...
});
```

### Touch Target Assertions

For mobile task flows, assert ALL tappable elements meet 44px minimum — not just primary CTAs:

```typescript
import { assertTouchTarget } from "../a11y-assertions";

// Check every tappable element, not just the main CTA
const tappableElements = page.getByRole("button");
const count = await tappableElements.count();
for (let i = 0; i < count; i++) {
  await assertTouchTarget(tappableElements.nth(i));
}
```

### Confirmation Message Assertions

For tasks with completion flows (round submission, subscription upgrade, admin approval/rejection, profile updates), assert confirmation messages include the entity, action, and status — not just a generic "success":

```typescript
// Good — asserts meaningful content
await expect(page.getByRole("status")).toContainText(/pebble beach/i);
await expect(page.getByRole("status")).toContainText(/awaiting approval/i);

// Bad — only checks for generic success
await expect(page.getByRole("status")).toContainText(/success/i);
```

### Exact Label Assertions

Assert the exact UI strings users see. Pull these from the task context file or from the component source — don't invent them:

```typescript
await expect(page.getByRole("button")).toHaveText("Submit round");
await expect(page.getByRole("heading", { level: 1 })).toContainText("Your handicap");
```

---

## Mode 2: Agentic Testing (agent-browser)

**When:** After a feature is implemented. Tests discoverability and intuitiveness.

**Tool:** `agent-browser` CLI with persona behavioral prompts.

**How it works:** The agent receives a persona prompt and a task instruction from the context file. It navigates via screenshots only — no DOM access. Confusion IS the signal.

### Metrics

| Metric | What it measures |
|--------|-----------------|
| Click count vs. optimal | Navigation efficiency |
| Time-to-task-completion | Overall usability |
| Wrong-click rate | UI clarity |
| Backtracking frequency | Information architecture |

### First-Impression Pattern (C-1, A-1)

Ask the agent to describe what the app does BEFORE interacting. Capture qualitative signal about whether the interface communicates its purpose ("track your golf handicap"), not generic SaaS chrome.

For Playwright (Mode 1), assert identity elements are above the fold:

```typescript
const heading = page.getByRole("heading", { level: 1 });
const box = await heading.boundingBox();
expect(box).not.toBeNull();
expect(box!.y).toBeLessThan(600); // above fold
```

### Error Recovery Pattern

Context files include 1–2 error scenarios per task (rejected submission, declined card, wrong tee selected). Inject deliberate wrong actions and evaluate how well the system guides the user back:

- Does an error message appear?
- Is the message actionable (tells the user what to do — e.g. "Update your card in Billing")?
- Can the agent recover without starting over?

### Agentic Test Structure

```
1. Load persona prompt from context file
2. Give agent the task (e.g. "Submit your round from yesterday at Pebble Beach")
3. Agent navigates via screenshots
4. Record: clicks, wrong turns, backtracking, time
5. Compare against optimal path
6. Flag confusion points for UX review
```

---

## Mode 3: Accessibility Testing (Playwright + Mechanical Constraints)

**When:** Every feature, layered on scripted E2E.

**Tool:** Playwright with keyboard-only, reflow-320, forced-colors projects + axe-core fixture.

**Catches:** Keyboard failures, focus management, reflow breakage, ARIA violations, forced-colors visibility.

### Playwright Projects

The `playwright.config.ts` (when introduced) should define specialized projects for accessibility:

| Project | What it simulates |
|---------|------------------|
| `keyboard-only` | No mouse. Tab/Enter/Space/Arrow navigation only. |
| `reflow-320` | 320px viewport width at 400% zoom equivalent. |
| `forced-colors` | Windows High Contrast Mode. |

### axe-core Integration

Every page test includes an axe scan:

```typescript
import { test, expect } from "../a11y-test";

test("page has no a11y violations", async ({ page, makeAxeBuilder }) => {
  await page.goto("/rounds/new");
  const results = await makeAxeBuilder().analyze();
  expect(results.violations).toEqual([]);
});
```

### Custom Assertion Helpers

Import from `e2e/a11y-assertions.ts` for issues axe-core cannot catch:

| Helper | WCAG SC | What it catches |
|--------|---------|-----------------|
| `assertAriaLive` | 4.1.3 | Missing status announcements (round submitted, approval decided) |
| `assertFocusAfterNavigation` | 2.4.3 | Focus lost after route changes |
| `assertSkipLink` | 2.4.1 | Missing skip-to-content link |
| `assertTouchTarget` | 2.5.5 | Touch targets below 44px |
| `assertForcedColorsVisible` | 2.4.7 | Focus indicators invisible in high contrast |
| `assertLangAttribute` | 3.1.1 | Missing or wrong `lang` attribute |

### Skill Delegation

Delegate to existing skills for structured checklists:

- `/keyboard-test` — generates keyboard navigation test checklist
- `/screen-reader-test` — generates screen reader test scripts

---

## Test Data & Services

E2E tests in this project typically need:

| Concern | How to handle |
|---------|---------------|
| Authenticated customer session | `storageState` seeded via Supabase Auth admin API before the run |
| Authenticated admin session | Separate `storageState` with an admin-role user |
| Round / course / tee fixtures | Service-role Supabase client in a setup script (bypasses RLS for seeding) |
| Subscription state | Stripe test-mode customer + subscription seeded via Stripe CLI or the SDK |
| Webhook delivery | Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook` during the run |

Keep seeding scripts in `e2e/setup/` and tear down with the same clients. Do not hit production Stripe or the remote Supabase project from E2E.
