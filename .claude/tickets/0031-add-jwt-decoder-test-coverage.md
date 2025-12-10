# 0031 - Add Test Coverage for JWT Decoder Utility

## 🎯 **Description**

Add comprehensive test coverage for the `base64urlDecode` function and JWT decoding utilities in `utils/supabase/jwt.ts`. This is a security-critical utility that handles JWT decoding in both browser and Node.js environments but currently has zero test coverage.

## 📋 **User Story**

As a developer, I want comprehensive test coverage for JWT decoding utilities so that billing-critical functionality is protected against regressions and edge cases are properly handled.

## 🔧 **Technical Context**

The `base64urlDecode` function is used by `getBillingFromJWT` and `getAppMetadataFromJWT` to extract billing claims from Supabase access tokens. While the JWT signature is verified by Supabase, bugs in the decoder could:
- Fail to decode valid tokens (breaking billing entirely)
- Throw uncaught errors that crash the application
- Misinterpret billing data leading to incorrect access control

The function has cross-environment complexity:
- **Browser environment**: Uses `atob()` for base64 decoding
- **Node.js environment**: Uses `Buffer.from()` for base64 decoding

Recent work on billing sync (commits: `258ddb3`, `8b0f72c`, `d71d81c`) shows this is actively being debugged. Test coverage would prevent future regressions.

## ✅ **Acceptance Criteria**

- [ ] Test file created at `utils/supabase/__tests__/jwt.test.ts`
- [ ] All tests pass using vitest (matching project's existing test framework)
- [ ] Test coverage includes both `base64urlDecode` and its consumers
- [ ] Both browser and Node.js environments are tested
- [ ] Edge cases and error conditions are covered
- [ ] Tests follow the pattern established in `utils/billing/__tests__/pricing.test.ts`

## 🚨 **Technical Requirements**

### **Implementation Details**

Create `utils/supabase/__tests__/jwt.test.ts` following the existing vitest pattern:

```typescript
import { describe, test, expect, vi } from 'vitest';
import { getBillingFromJWT, getAppMetadataFromJWT } from '../jwt';
import type { Session } from '@supabase/supabase-js';
```

### **Test Categories**

#### 1. **base64urlDecode Tests** (via getBillingFromJWT)

**Valid Decoding:**
- Correctly decode base64url strings with different padding requirements
- Handle strings with length % 4 === 0 (no padding needed)
- Handle strings with length % 4 === 2 (2 `=` padding)
- Handle strings with length % 4 === 3 (1 `=` padding)

**Character Conversion:**
- Convert `-` to `+` correctly
- Convert `_` to `/` correctly
- Handle mixed base64url special characters

**Error Handling:**
- Throw error for invalid base64url (pad === 1 case)
- Handle malformed base64 strings gracefully
- Return null for invalid JSON after decoding

#### 2. **Environment-Specific Tests**

**Browser Environment:**
- Mock `atob()` and verify it's called with correct input
- Mock `window` object to simulate browser environment
- Verify browser decoding produces correct output

**Node.js Environment:**
- Mock `Buffer.from()` to verify Node.js path
- Simulate missing `window` object
- Verify Node.js decoding produces correct output

#### 3. **getBillingFromJWT Tests**

**Valid Cases:**
- Extract billing claims from valid JWT
- Handle JWT with all billing fields present
- Handle JWT with minimal billing fields (nulls)
- Return null for missing `app_metadata.billing`

**Error Cases:**
- Return null for null session
- Return null for session without access_token
- Return null for malformed JWT (not 3 parts)
- Catch and log errors for invalid base64
- Catch and log errors for invalid JSON

#### 4. **getAppMetadataFromJWT Tests**

**Valid Cases:**
- Extract full app_metadata from valid JWT
- Handle JWT with multiple app_metadata fields
- Handle JWT with only billing in app_metadata

**Error Cases:**
- Return null for null session
- Return null for session without access_token
- Return null for malformed JWT
- Handle missing app_metadata gracefully

### **Dependencies**

- Vitest (already in project)
- Existing test utilities from `utils/billing/__tests__/pricing.test.ts`

### **Integration Points**

- Must not modify production code in `utils/supabase/jwt.ts`
- Should use same vitest configuration as existing tests
- Should run as part of existing test suite

## 🔍 **Implementation Notes**

### **Mock JWT Structure**

Create helper functions to generate valid test JWTs:

```typescript
function createMockJWT(payload: Record<string, any>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

function createMockSession(billing: any): Session {
  const payload = {
    sub: 'user-123',
    app_metadata: { billing }
  };
  return {
    access_token: createMockJWT(payload),
    // ... other session fields
  } as Session;
}
```

### **Environment Mocking Strategy**

```typescript
// Mock browser environment
const mockAtob = vi.fn();
vi.stubGlobal('atob', mockAtob);
vi.stubGlobal('window', {});

// Mock Node.js environment (remove window)
vi.unstubAllGlobals();
```

### **Padding Test Cases**

```typescript
// No padding needed (length % 4 === 0)
'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ'

// 2 padding chars needed (length % 4 === 2)
'eyJzdWIiOiIxMjM0NTY3ODkwIn0'

// 1 padding char needed (length % 4 === 3)
'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0'

// Invalid (length % 4 === 1) - should throw
'abc'
```

## 📊 **Definition of Done**

- [ ] Test file created with all test categories covered
- [ ] All tests passing in CI/CD pipeline
- [ ] Code coverage report shows 100% coverage for `utils/supabase/jwt.ts`
- [ ] Tests can be run with `pnpm test:unit`
- [ ] No production code modified (tests only)

## 🧪 **Testing Requirements**

### **Test Execution**
- [ ] Tests run successfully with `pnpm test:unit`
- [ ] Tests run successfully with `pnpm test` (full suite)
- [ ] All edge cases pass

### **Coverage Requirements**
- [ ] 100% line coverage for `base64urlDecode`
- [ ] 100% line coverage for `getBillingFromJWT`
- [ ] 100% line coverage for `getAppMetadataFromJWT`
- [ ] All branches covered (if/else, try/catch)

### **Edge Cases**
- [ ] Empty strings handled
- [ ] Null/undefined inputs handled
- [ ] Malformed JWTs handled
- [ ] Invalid base64 handled
- [ ] Invalid JSON handled
- [ ] Both environments (browser/Node.js) tested

## 🚫 **Out of Scope**

- Modifying the production code in `utils/supabase/jwt.ts`
- JWT signature verification (already handled by Supabase)
- Integration tests with real Supabase tokens
- Performance optimization of decoder
- Adding TypeScript strict mode compliance
- Refactoring the decoder implementation

## 📝 **Notes**

### **Why This Matters**

1. **Security-Critical**: Billing access control depends on this decoder
2. **Cross-Environment**: Two completely different code paths need testing
3. **Recent Issues**: Recent commits show active debugging of JWT/billing sync
4. **Zero Coverage**: Currently no tests for this critical utility
5. **Regression Prevention**: Tests will catch future breaking changes

### **Existing Test Pattern**

Follow the structure in `utils/billing/__tests__/pricing.test.ts`:
- Use `describe` blocks for logical grouping
- Use `test` (not `it`) for test cases
- Use `vi.spyOn` for mocking console methods
- Clean up mocks with `.mockRestore()`
- Use descriptive test names: "should [behavior] when [condition]"

### **References**

- Existing billing tests: `utils/billing/__tests__/pricing.test.ts`
- JWT utilities: `utils/supabase/jwt.ts`
- Vitest docs: https://vitest.dev/
- Base64url spec: RFC 4648 Section 5

## 🏷️ **Labels**

- `priority: high`
- `type: testing`
- `component: billing`
- `component: authentication`
- `security`
- `technical-debt`
- `good-first-issue` (well-defined scope, clear examples)
