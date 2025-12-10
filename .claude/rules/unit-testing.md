---
alwaysApply: false
---

# Unit Testing Rules

## Overview

Unit tests should be small, focused, and test individual functions or components in isolation. They should be fast, reliable, and clearly express what they're testing.

## File Structure & Naming

- Place all unit tests in `test/unit/` directory
- Use `.test.ts` or `.test.tsx` extension (avoid `.spec.`)
- Name test files to match the component/function being tested: `button.test.tsx`, `formatRanking.test.ts`
- Use kebab-case for file names

## Import Guidelines

- **ALWAYS** use import aliases: `@/components/button` ✅
- **NEVER** use relative paths: `../../../components/button` ❌
- Import React explicitly for TSX files: `import React from 'react';`
- Import testing utilities from appropriate packages:
  ```typescript
  import { expect, test, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  ```

## Test Structure & Naming

### Test Names Should Be Self-Explanatory

```typescript
// ✅ Good - Clear what is being tested
test('Button renders with correct label and icon', () => {});
test('formatRanking pads single digits with leading zero', () => {});
test('scoreToRating returns empty string for invalid scores', () => {});

// ❌ Bad - Vague or unclear
test('Button works', () => {});
test('formatting', () => {});
test('edge case', () => {});
```

### Use Descriptive Test Names That Follow Pattern:

- **Component tests**: `"ComponentName [action/state] [expected outcome]"`
- **Function tests**: `"functionName [input/condition] [expected output/behavior]"`

## Test Categories

### 1. Happy Path Tests

Test the main functionality with valid inputs:

```typescript
test('formatRanking formats single digit numbers with leading zero', () => {
  expect(formatRanking(1)).toBe('01');
  expect(formatRanking(5)).toBe('05');
});
```

### 2. Edge Cases

Test boundary conditions and unusual but valid inputs:

```typescript
test('scoreToRating handles boundary scores correctly', () => {
  expect(scoreToRating(90)).toBe('Excellent'); // boundary
  expect(scoreToRating(89)).toBe('Very good'); // just below boundary
});
```

### 3. Error Cases

Test invalid inputs and error conditions:

```typescript
test('scoreToRating returns empty string for invalid scores', () => {
  expect(scoreToRating(-1)).toBe('');
  expect(scoreToRating(101)).toBe('');
  expect(scoreToRating(NaN)).toBe('');
  expect(scoreToRating(Infinity)).toBe('');
});
```

### 4. Component Interaction Tests

Test user interactions and state changes:

```typescript
test('Button calls onClick handler when clicked', () => {
  const handleClick = vi.fn();
  render(<Button label="Test" icon="🚀" onClick={handleClick} />);

  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

## Best Practices

### Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
test('Button applies active styles when isActive is true', () => {
  // Arrange
  const props = { label: 'Test', icon: '✓', isActive: true };

  // Act
  render(<Button {...props} />);

  // Assert
  const labelElement = screen.getByText('Test');
  expect(labelElement).toHaveClass('td_underline');
});
```

### Use Meaningful Test Data

```typescript
// ✅ Good - Clear what each value represents
test('scoreToRating returns correct ratings for score ranges', () => {
  expect(scoreToRating(100)).toBe('Excellent'); // perfect score
  expect(scoreToRating(90)).toBe('Excellent'); // excellent threshold
  expect(scoreToRating(89)).toBe('Very good'); // just below excellent
});

// ❌ Bad - Magic numbers without context
test('scoreToRating works', () => {
  expect(scoreToRating(100)).toBe('Excellent');
  expect(scoreToRating(42)).toBe('Fair');
});
```

### Mock External Dependencies

```typescript
test('Component calls external service correctly', () => {
  const mockService = vi.fn().mockReturnValue('mocked result');
  vi.mock('@/services/externalService', () => ({
    callService: mockService,
  }));

  // Test implementation
  expect(mockService).toHaveBeenCalledWith(expectedParams);
});
```

### Test CSS Classes and Styling (PandaCSS)

When testing styled components, verify CSS classes are applied:

```typescript
test('Button applies correct PandaCSS classes', () => {
  render(<Button label="Test" icon="🚀" isButtonGroup={true} />);

  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg_bg.button');
  expect(button).toHaveClass('p_10px_10px');
});
```

## What NOT to Test in Unit Tests

### ❌ Don't Test Implementation Details

```typescript
// ❌ Bad - Testing internal state/methods
test('Component has correct internal state', () => {
  const component = render(<MyComponent />);
  expect(component.instance().internalStateVariable).toBe(someValue);
});

// ✅ Good - Test observable behavior
test('Component displays loading state initially', () => {
  render(<MyComponent />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
```

### ❌ Don't Test External Dependencies

```typescript
// ❌ Bad - Testing API calls (this is integration/E2E)
test('Component fetches data from API', async () => {
  render(<MyComponent />);
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/data');
  });
});
```

### ❌ Don't Test Framework Functionality

```typescript
// ❌ Bad - Testing React itself
test('useState works correctly', () => {
  // Don't test React's built-in functionality
});
```

## Mocking Guidelines

### Mock Functions

```typescript
const mockHandler = vi.fn();
// Test that it was called
expect(mockHandler).toHaveBeenCalledTimes(1);
expect(mockHandler).toHaveBeenCalledWith(expectedArgs);
```

### Mock Modules

```typescript
vi.mock('@/utils/externalModule', () => ({
  utilityFunction: vi.fn().mockReturnValue('mocked value'),
}));
```

### Clean Up Mocks

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Performance & Organization

### Keep Tests Fast

- Avoid heavy computations
- Mock external dependencies
- Use minimal setup

### Group Related Tests

```typescript
// Group tests for the same function/component
describe('scoreToRating', () => {
  test('returns correct rating for excellent scores', () => {});
  test('returns correct rating for poor scores', () => {});
  test('handles edge cases correctly', () => {});
});
```

### Test One Thing at a Time

```typescript
// ✅ Good - Single responsibility
test('Button renders label correctly', () => {
  render(<Button label="Test Label" icon="🚀" />);
  expect(screen.getByText('Test Label')).toBeInTheDocument();
});

test('Button renders icon correctly', () => {
  render(<Button label="Test" icon="🚀" />);
  expect(screen.getByText('🚀')).toBeInTheDocument();
});

// ❌ Bad - Testing multiple concerns
test('Button renders everything correctly', () => {
  // Testing label, icon, styling, interactions all in one test
});
```

## Error Handling Tests

Always test error conditions:

```typescript
test('function throws error for invalid input', () => {
  expect(() => riskyFunction(invalidInput)).toThrow('Expected error message');
});

test('function returns fallback for invalid input', () => {
  expect(safeFunctionWithFallback(invalidInput)).toBe(fallbackValue);
});
```

## Documentation Through Tests

Tests should serve as documentation:

```typescript
// ✅ Good - Test name explains the business rule
test('scoreToRating returns empty string for scores above 100', () => {
  expect(scoreToRating(101)).toBe('');
  expect(scoreToRating(150)).toBe('');
});

// This test documents that scores > 100 are considered invalid
```

## Common Pitfalls to Avoid

1. **Don't rely on comments** - Test names should be self-explanatory
2. **Don't test multiple scenarios in one test** - Split into separate tests
3. **Don't use production data** - Use minimal, focused test data
4. **Don't forget to test error cases** - Happy path is not enough
5. **Don't make tests dependent on each other** - Each test should be independent
6. **Don't test private methods** - Test public API and observable behavior

Remember: Good unit tests are fast, focused, and provide confidence that individual pieces work correctly in isolation.
