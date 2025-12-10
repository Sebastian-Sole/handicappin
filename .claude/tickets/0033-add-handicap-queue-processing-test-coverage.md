# 0033 - Add Test Coverage for Handicap Queue Processing Logic

## 🎯 **Description**

Add comprehensive unit test coverage for the `processUserHandicap` function in the handicap queue processor. The function implements a critical multi-pass algorithm (passes 1-3) for calculating golf handicaps with exceptional score adjustments, and currently lacks test coverage for edge cases and error scenarios.

## 📋 **User Story**

As a developer, I want comprehensive test coverage for the handicap calculation queue processing logic so that I can confidently make changes without breaking critical handicap calculations that affect user experience.

## 🔧 **Technical Context**

The `processUserHandicap` function in `supabase/functions/process-handicap-queue/index.ts:111-418` implements a complex three-pass algorithm:

1. **Pass 1 (lines 250-292)**: Calculates adjusted gross scores for each round
2. **Pass 2 (lines 294-328)**: Calculates raw differentials and detects Exceptional Score Reductions (ESR)
3. **Pass 3 (lines 330-359)**: Applies ESR offsets, calculates final differentials, and applies handicap caps for users with 20+ rounds

This function handles critical business logic including:
- User profile lookup and validation
- Round data fetching and validation
- Score differential calculations
- Exceptional Score Reduction (ESR) detection and application
- Handicap cap application for users with 20+ rounds
- Atomic database updates via stored procedures
- Error handling and retry logic

Currently, there is no test coverage for this function, leaving critical edge cases and error scenarios unvalidated.

## ✅ **Acceptance Criteria**

- [ ] Test file created at `supabase/functions/process-handicap-queue/__tests__/processUserHandicap.test.ts`
- [ ] All edge cases specified in Technical Requirements are covered
- [ ] Tests use Vitest framework (consistent with existing test structure)
- [ ] Tests achieve minimum 80% code coverage for `processUserHandicap` function
- [ ] Tests properly mock Supabase client and database operations
- [ ] Tests validate both success and error scenarios
- [ ] Tests run successfully in CI/CD pipeline

## 🚨 **Technical Requirements**

### **Implementation Details**

Create a test suite using Vitest that covers the `processUserHandicap` function. The tests should:

1. **Mock the Supabase client** to avoid real database calls
2. **Test data setup** using factory functions or fixtures for consistent test data
3. **Assertion patterns** that validate:
   - Correct handicap index calculations
   - Proper ESR offset application
   - Database update calls with correct parameters
   - Error handling and queue status updates

**Example test structure:**

```typescript
import { describe, test, expect, vi, beforeEach } from "vitest";
import { processUserHandicap } from "../index.ts";

describe("processUserHandicap", () => {
  let mockSupabase: any;
  let mockJob: QueueJob;

  beforeEach(() => {
    // Setup mocks
    mockSupabase = createMockSupabase();
    mockJob = createMockJob();
  });

  describe("Edge Cases", () => {
    test("should handle user with no approved rounds", async () => {
      // Test implementation
    });

    test("should apply handicap caps for users with exactly 20 rounds", async () => {
      // Test implementation
    });

    // Additional edge case tests...
  });

  describe("Error Scenarios", () => {
    test("should handle missing user profile", async () => {
      // Test implementation
    });

    // Additional error tests...
  });
});
```

### **Dependencies**

- **Testing Framework**: Vitest (already in use per `tests/unit/logging.test.ts`)
- **Mocking Library**: Vitest's built-in mocking (`vi.fn()`, `vi.mock()`)
- **File to Test**: `supabase/functions/process-handicap-queue/index.ts`
- **Shared Utilities**: `supabase/functions/handicap-shared/utils.ts` (may need to be mocked or imported)

### **Integration Points**

- Tests should mock all Supabase database calls
- Tests should validate calls to stored procedures: `process_handicap_no_rounds` and `process_handicap_updates`
- Tests should verify queue status updates on both success and failure

## 🔍 **Implementation Notes**

### **Critical Edge Cases to Test**

1. **No Rounds Scenario**:
   - User has no approved rounds
   - Should call `process_handicap_no_rounds` RPC with `MAX_SCORE_DIFFERENTIAL` (54)
   - Should not attempt to calculate handicap

2. **Exactly 20 Rounds (Handicap Cap Trigger)**:
   - User has exactly 20 rounds
   - Should trigger handicap cap logic (lines 345-350)
   - Should call `calculateLowHandicapIndex` and `applyHandicapCaps`
   - Verify cap is applied correctly

3. **19 Rounds (No Handicap Cap)**:
   - User has 19 rounds
   - Should NOT apply handicap caps
   - Should use raw `calculateHandicapIndex` result

4. **Exceptional Score Adjustments**:
   - Round differential 7+ strokes better than existing handicap (lines 316-325)
   - Difference >= 10 strokes: ESR offset = 2
   - Difference 7-9 strokes: ESR offset = 1
   - ESR applies to all rounds in the 20-round window

5. **Maximum Handicap Cap**:
   - Final handicap index should never exceed `MAX_SCORE_DIFFERENTIAL` (54)
   - Verify line 355-358 enforcement

6. **Data Validation Errors**:
   - Invalid rounds data fails schema parsing (line 149-152)
   - Invalid tees data fails schema parsing (line 184-187)
   - Invalid holes data fails schema parsing (line 198-201)
   - Invalid scores data fails schema parsing (line 213-216)

7. **Missing Data Errors**:
   - User profile not found (lines 127-129)
   - Tee not found for round (line 253)
   - Scores not found for round (line 256)
   - Holes not found for tee (line 259)

8. **Database Transaction Errors**:
   - RPC call to `process_handicap_updates` fails (lines 384-386)
   - RPC call to `process_handicap_no_rounds` fails (lines 167-169)
   - Queue status update fails (lines 398-413)

9. **Retry Logic**:
   - Job attempts < MAX_RETRIES: status remains "pending"
   - Job attempts >= MAX_RETRIES: status changes to "failed"
   - Error message is captured in queue record

### **Testing Strategy**

1. **Unit Test Isolation**:
   - Extract `processUserHandicap` to allow testing without invoking Deno.serve handler
   - Mock all database operations
   - Use deterministic test data

2. **Mock Data Factories**:
   - Create helper functions to generate valid test data for rounds, tees, holes, scores
   - Allow easy customization for specific test scenarios

3. **Assertion Patterns**:
   - Verify function calls with `expect(mockFn).toHaveBeenCalledWith(...)`
   - Validate calculation results against expected values
   - Check error handling with `expect(fn).rejects.toThrow(...)`

## 📊 **Definition of Done**

- [ ] Test file created with minimum 15 test cases covering all edge cases
- [ ] All tests pass locally via `pnpm test:unit`
- [ ] Code coverage report shows 80%+ coverage for `processUserHandicap`
- [ ] Tests validate all three calculation passes (Pass 1, 2, 3)
- [ ] Error scenarios properly tested with appropriate assertions
- [ ] Retry logic tested for both under and over MAX_RETRIES threshold
- [ ] No real database calls in tests (all mocked)
- [ ] Tests execute in under 5 seconds total

## 🧪 **Testing Requirements**

### **Unit Tests (New)**

- [ ] User with no rounds sets handicap to MAX_SCORE_DIFFERENTIAL
- [ ] User with 1-19 rounds calculates handicap without caps
- [ ] User with exactly 20 rounds applies handicap caps
- [ ] User with 21+ rounds applies handicap caps
- [ ] ESR offset = 1 when difference is 7-9 strokes
- [ ] ESR offset = 2 when difference is 10+ strokes
- [ ] ESR offset applies to entire 20-round window retroactively
- [ ] Maximum handicap cap is enforced at 54
- [ ] Invalid rounds data throws validation error
- [ ] Invalid tees data throws validation error
- [ ] Invalid holes data throws validation error
- [ ] Invalid scores data throws validation error
- [ ] Missing user profile throws error
- [ ] Missing tee reference throws error
- [ ] Database RPC failures are caught and logged
- [ ] Queue job marked "pending" when attempts < MAX_RETRIES
- [ ] Queue job marked "failed" when attempts >= MAX_RETRIES
- [ ] Error messages are captured in queue records

### **Integration Tests**

- [ ] Not required for this ticket (unit tests only)

## 🚫 **Out of Scope**

- End-to-end testing with real Supabase database
- Testing the Deno.serve handler function (only `processUserHandicap` function)
- Testing shared utility functions in `handicap-shared/utils.ts` (assumes they are tested separately)
- Performance testing or load testing
- Testing the queue batch processing logic (only single user processing)
- Modifying the existing `processUserHandicap` implementation (only adding tests)

## 📝 **Notes**

- The `processUserHandicap` function is 307 lines long with complex multi-pass logic, making it a prime candidate for comprehensive unit testing
- Current project uses Vitest for testing (see `tests/unit/logging.test.ts`)
- Consider refactoring `processUserHandicap` into smaller, testable functions in a future ticket if test complexity becomes unmanageable
- May need to add `export` keyword to `processUserHandicap` function to make it testable, or use test utilities to access private functions
- Ensure test data uses valid Zod schemas from `handicap-shared/scorecard.ts` for realistic testing

## 🏷️ **Labels**

- `priority: high`
- `type: testing`
- `component: handicap-calculation`
- `component: queue-processing`
- `technical-debt`
- `quality-improvement`
