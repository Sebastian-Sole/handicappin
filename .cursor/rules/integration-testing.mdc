---
alwaysApply: false
---

# Integration Testing Rules

## Overview

Integration tests verify that different parts of the system (frontend,
backend, database, services) work together correctly. They are broader
than unit tests but narrower than full end-to-end tests. Integration
tests should use **real implementations of your own services** while
mocking only truly external dependencies (Stripe, Auth0, third-party
APIs).

## File Structure & Naming

- Place all integration tests in `test/integration/` directory
- Use `.test.ts` or `.test.tsx` extension (avoid `.spec.`)
- Name test files to reflect the feature or integration:
  `usersPage.test.ts`, `authFlow.test.ts`. .tsx files use kebab-case naming.
- Use kebab-case for file names

## Import Guidelines

- **ALWAYS** use import aliases: `@/pages/users` ✅

- **NEVER** use relative paths: `../../../pages/users` ❌

- Import React explicitly for TSX files: `import React from 'react';`

- Import testing utilities and Vitest functions consistently:

  ```typescript
  import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
  import { render, screen, waitFor } from '@testing-library/react';
  ```

## Test Structure & Naming

### Test Names Should Clearly Express Integration Intent

```typescript
// ✅ Good
test('users page fetches data from backend and renders table rows', async () => {});
test('login page handles 401 response from backend and shows error', async () => {});

// ❌ Bad
test('users page works', async () => {});
test('login test', async () => {});
```

### Use Pattern

- `"Feature/Component [integration boundary] [expected outcome]"`

Example: - `"UsersPage fetches from backend API and renders table data"`

## Test Categories

### 1. Happy Path Integrations

Verify successful communication between layers:

```typescript
test('UsersPage fetches users and renders their names in table', async () => {
  render(<UsersPage />);
  const rows = await screen.findAllByRole('row');
  expect(rows.length).toBeGreaterThan(1);
});
```

### 2. Error Handling Integrations

Verify that API errors or service failures are handled correctly:

```typescript
test('UsersPage shows error message on 500 response', async () => {
  render(<UsersPage />);
  const error = await screen.findByText(/failed to load/i);
  expect(error).toBeInTheDocument();
});
```

### 3. Boundary Conditions

Verify edge cases with seeded test data:

```typescript
test('UsersPage shows empty state when no users exist', async () => {
  render(<UsersPage />);
  const emptyMessage = await screen.findByText(/no users found/i);
  expect(emptyMessage).toBeInTheDocument();
});
```

## Best Practices

### Arrange-Act-Assert Pattern

Structure integration tests explicitly:

```typescript
test('DashboardPage fetches statistics and displays them', async () => {
  // Arrange - database seeded with test stats

  // Act
  render(<DashboardPage />);

  // Assert
  const stats = await screen.findByText(/Active Users: 42/);
  expect(stats).toBeInTheDocument();
});
```

### Use Real APIs, Not Mocks (For Your Own Services)

- **Frontend ↔ Backend**: Use a real local/test backend instance.
- **Backend ↔ Database**: Use a real test DB (seed/reset for each
  run).
- **External Services**: Mock them (Stripe, Auth0, 3rd party APIs).

### Test Observable Behavior, Not Implementation

✅ Good: Check rendered UI or API responses\
❌ Bad: Check that a mocked function was called (that's a unit test)

### Keep State Predictable

- Reset database or backend state before each test
- Seed with minimal, focused data
- Avoid dependencies between tests

## What NOT to Test in Integration Tests

- ❌ Don't test isolated UI logic (that belongs in unit tests)
- ❌ Don't test through a browser (that's E2E)
- ❌ Don't mock your own backend (that reduces test value)
- ❌ Don't assert on implementation details (test observable outcomes
  instead)

## Mocking Guidelines

- **Mock ONLY external/uncontrollable services**\
  Example: Payment providers, email/SMS gateways, 3rd party APIs

```typescript
vi.mock('@/services/stripeClient', () => ({
  charge: vi.fn().mockResolvedValue({ id: 'mock-charge' }),
}));
```

- **NEVER mock your own API** if the point is to test integration

## Performance & Organization

- Integration tests are slower than unit tests --- keep them focused
- Use separate CI pipeline/job from unit tests
- Run them against disposable, isolated test environments
- Group related tests using `describe` blocks

```typescript
describe('UsersPage integration', () => {
  test('renders with seeded users', async () => {});
  test('shows empty state with no users', async () => {});
});
```

## Error Handling Tests

Always test failure conditions between layers:

```typescript
test('API returns 401 for unauthorized requests', async () => {
  const response = await fetch('/api/secure-data');
  expect(response.status).toBe(401);
});
```

## Documentation Through Tests

Use test names and data to document system contracts:

```typescript
// ✅ Documents that expired sessions return 401
test('API returns 401 when session token is expired', async () => {});
```

## Common Pitfalls to Avoid

1.  **Don't mock your own backend** --- defeats the purpose of
    integration tests\
2.  **Don't rely on flaky external APIs** --- mock them or run local
    stubs\
3.  **Don't skip error cases** --- failure paths are just as important\
4.  **Don't mix UI-only unit tests here** --- keep them separate\
5.  **Don't forget environment cleanup** --- DB resets, cache clears,
    server teardown

Remember: Integration tests prove that _your system's layers actually
work together_, not just that mocks return what you told them to.
