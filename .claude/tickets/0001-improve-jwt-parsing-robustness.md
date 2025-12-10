# 0001 - Improve JWT Parsing Robustness

## 🎯 **Description**

Enhance JWT parsing utilities to use a proper JWT library (jose) instead of manual Buffer decoding, and add defensive validation checks for billing claims structure.

## 📋 **User Story**

As a developer, I want robust JWT parsing with proper validation so that edge cases are handled gracefully and the codebase is more maintainable.

## 🔧 **Technical Context**

Currently `getBillingFromJWT()` and `getAppMetadataFromJWT()` in `utils/supabase/jwt.ts` manually decode JWTs using `Buffer.from()`. While this works and the JWT signature is already verified by Supabase's `getSession()`, using a proper JWT library would:
- Provide better error handling
- Add expiry validation as defense-in-depth
- Validate claims structure
- Improve maintainability

The middleware already imports `jose`, so we have the dependency available.

## ✅ **Acceptance Criteria**

- [ ] Replace manual Buffer decoding with `jose` library for parsing
- [ ] Add JWT expiry check as defense-in-depth
- [ ] Add runtime validation for billing claims structure (plan, status, etc.)
- [ ] Maintain backward compatibility with existing callers
- [ ] Update tests if they exist

## 🚨 **Technical Requirements**

### **Implementation Details**

Replace manual decoding:
```typescript
// Current approach
const parts = session.access_token.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

// New approach using jose
import { decodeJwt } from 'jose';
const payload = decodeJwt(session.access_token);
```

Add validation:
```typescript
// Validate billing claims structure
if (billing && typeof billing === 'object') {
  // Ensure expected fields exist and have correct types
}
```

### **Dependencies**

- `utils/supabase/jwt.ts` - Main implementation file
- `jose` library - Already imported in middleware

### **Integration Points**

- Used by `app/onboarding/page.tsx`
- Used by `app/upgrade/page.tsx`
- Used by `utils/supabase/middleware.ts`

## 🔍 **Implementation Notes**

- Keep security comments that explain JWT signature is already verified by Supabase
- Error handling should fail gracefully (return null) as it does now
- Consider adding TypeScript type guards for billing claims validation
- This is a refactoring task - behavior should remain the same

## 📊 **Definition of Done**

- [ ] JWT parsing uses `jose` library
- [ ] Defensive validation added for claims structure
- [ ] All existing callers continue to work unchanged
- [ ] Security documentation remains clear

## 🧪 **Testing Requirements**

- [ ] Manual testing of onboarding flow
- [ ] Manual testing of upgrade page
- [ ] Test with valid JWT
- [ ] Test with missing/malformed billing claims
- [ ] Verify middleware authorization still works

## 🚫 **Out of Scope**

- Changing the overall authentication/authorization strategy
- Adding new JWT claims
- Modifying Supabase access token hook
- Performance optimization

## 📝 **Notes**

This is a nice-to-have improvement for code quality and robustness. The current implementation is functionally secure and works correctly. Priority is low since this is technical debt / defensive programming rather than a bug or feature.

## 🏷️ **Labels**

- `priority: low`
- `type: enhancement`
- `component: auth`
- `technical-debt`
- `defensive-programming`
