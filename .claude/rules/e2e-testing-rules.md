---
alwaysApply: false
---

# End-to-End (E2E) Testing Rules

## Overview

E2E tests verify the **entire system flow** from the perspective of a
real user. They simulate real interactions in a browser, using
**Playwright** to automate clicks, navigation, form inputs, and
assertions on visible UI. These tests ensure that all system layers
(frontend, backend, database, external services) work together in a
production-like environment. E2E tests should be **realistic, stable, and high-value**, covering
critical user journeys without duplicating unit/integration test
coverage.

## File Structure & Naming

- Place all E2E tests in `test/e2e/` directory
- Use `.e2e.spec.ts` or `.e2e.spec.tsx` extension
- File names should describe the user flow or feature:
  - `login-flow.spec.ts`
  - `checkout-process.spec.ts`
  - `dashboard-navigation.spec.ts`
- Use **kebab-case** for file names

## Import Guidelines

- Always use import aliases: `@/pages/dashboard` ✅

- Never use relative paths: `../../../pages/dashboard` ❌

- Import Playwright testing utilities consistently:

  ```typescript
  import { test, expect } from '@playwright/test';
  ```

## Test Structure & Naming

### Test Names Should Express User Behavior

```typescript
// ✅ Good
test('user can log in with valid credentials and sees dashboard', async ({ page }) => {});
test('user cannot log in with invalid password and sees error', async ({ page }) => {});

// ❌ Bad
test('login works', async ({ page }) => {});
test('dashboard test', async ({ page }) => {});
```

### Naming Pattern

- `"User [action] [expected outcome]"`
- Example:
  `"User adds product to cart and sees it in checkout summary"`

## Test Categories

### 1. Critical User Journeys

Focus on the most important workflows:

```typescript
test('user completes checkout successfully with valid card', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Login');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  await page.click('button[type=submit]');
  await page.click('text=Add to cart');
  await page.click('text=Checkout');
  await page.fill('#card-number', '4242 4242 4242 4242');
  await page.click('text=Pay');
  await expect(page.getByText(/order confirmed/i)).toBeVisible();
});
```

### 2. Error Handling & Edge Cases

```typescript
test('user cannot checkout with expired card', async ({ page }) => {
  await page.goto('/checkout');
  await page.fill('#card-number', '4000 0000 0000 0069'); // expired card test value
  await page.click('text=Pay');
  await expect(page.getByText(/card expired/i)).toBeVisible();
});
```

### 3. Cross-Page Navigation

```typescript
test('user navigates from dashboard to profile and back', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=Profile');
  await expect(page).toHaveURL('/profile');
  await page.click('text=Dashboard');
  await expect(page).toHaveURL('/dashboard');
});
```

## Best Practices

### Arrange-Act-Assert Pattern

```typescript
test('user sees welcome message after login', async ({ page }) => {
  // Arrange - ensure test user exists in DB

  // Act
  await page.goto('/login');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  await page.click('button[type=submit]');

  // Assert
  await expect(page.getByText(/welcome, test/i)).toBeVisible();
});
```

### Use Stable Selectors

- Prefer `data-testid` attributes for selectors
- Avoid brittle selectors like `.css-123` or inner text that may
  change

```typescript
await page.getByTestId('checkout-button').click();
```

### Keep Tests Independent

- Reset/seed database before each test
- Avoid dependencies between tests
- Never rely on leftover state from previous tests

### Focus on High-Value Flows

- Login/logout
- Navigation between key pages
- Checkout/payment
- Profile management
- Permissions & access control

### Mock Only Uncontrollable External Services

- Payments (Stripe test cards)
- Email/SMS gateways
- Third-party APIs

### Add data-testid where necessary

- Use pre-existing data-testid tags when applicable
- Add data-testid to html tags when they don't exist

```typescript
// Example: Stripe test card number ensures predictable behavior
await page.fill('#card-number', '4242 4242 4242 4242');
```

## What NOT to Test in E2E Tests

- ❌ Don't test every UI detail (that belongs in unit/integration
  tests)
- ❌ Don't test random edge cases not tied to user flows
- ❌ Don't duplicate what's already covered in integration/unit tests
- ❌ Don't assert on implementation details (e.g. function calls)
- ❌ Don't use flaky selectors (like dynamic classes)

## Test Helpers

Centralize helpers in `test-utils/e2eHelpers.ts`:

- `loginAsUser(page, email, password)`
- `seedDatabase()`
- `resetDatabase()`
- `mockExternalApi()`

Example:

```typescript
await loginAsUser(page, 'test@example.com', 'password123');
```

## Performance & Organization

- E2E tests are slowest --- keep them minimal & focused
- Run them in parallel where possible
- Group related tests with `describe` blocks
- Use Playwright's `beforeEach` and `afterEach` for setup/cleanup
- Separate CI pipeline from unit/integration tests

```typescript
describe('Checkout Flow', () => {
  test('user completes checkout successfully', async ({ page }) => {});
  test('user sees error with invalid card', async ({ page }) => {});
});
```

## Error Handling Tests

Always test failure paths that affect the user:

```typescript
test('unauthenticated user is redirected to login when accessing dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});
```

## Documentation Through Tests

Use descriptive names to document business rules:

```typescript
// ✅ Documents that only admins can access admin panel
test('non-admin user is denied access to admin panel', async ({ page }) => {
  await loginAsUser(page, 'user@example.com', 'password123');
  await page.goto('/admin');
  await expect(page.getByText(/access denied/i)).toBeVisible();
});
```

## Common Pitfalls to Avoid

1.  **Don't over-test** trivial flows already covered elsewhere
2.  **Don't use fragile selectors** --- rely on `data-testid`
3.  **Don't skip teardown** --- stale data causes flakiness
4.  **Don't ignore error paths** --- always test failures & access
    control
5.  **Don't run E2E tests against production** --- use test/staging env
