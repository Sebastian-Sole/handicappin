# 0001 - Fix Email Synchronization Drift Between Auth and Profile Tables

## 🎯 **Description**

Resolve data consistency issue where user email can become out of sync between `auth.users` and `profile` tables due to non-atomic update operations in the personal information form.

## 📋 **User Story**

As a user, I want my email address to remain consistent across all systems so that I don't encounter authentication issues or receive communications at the wrong address.

## 🔧 **Technical Context**

Currently, `PersonalInformationTab` component updates email in two separate operations:
1. Updates `auth.users.email` via `supabase.auth.updateUser()`
2. Updates `profile.email` via tRPC mutation

If step 1 succeeds but step 2 fails (network issue, DB error, etc.), the user's auth email diverges from their profile email, creating data inconsistency.

**Location**: `components/profile/tabs/personal-information-tab.tsx:74-95`

## ✅ **Acceptance Criteria**

- [ ] Email updates are atomic - either both succeed or both fail
- [ ] No email drift occurs between auth.users and profile tables
- [ ] Error handling provides clear feedback to users
- [ ] User experience remains smooth (no significant performance degradation)
- [ ] Existing email change functionality continues to work

## 🚨 **Technical Requirements**

### **Implementation Details**

Three potential approaches (choose based on codebase analysis):

**Option 1: Remove Email from Profile Table (Recommended)**
- Remove `email` column from `profile` table entirely
- Use `auth.users.email` as single source of truth
- Join with auth.users or pass authUser object where email is needed
- Requires migration to remove column and update queries

**Option 2: Server Action with Rollback**
- Create Next.js server action that updates profile first, then auth
- Implement manual rollback if auth update fails
- Still has edge cases but reduces likelihood of drift

**Option 3: Database Trigger/Function**
- Create PostgreSQL function that updates both atomically
- Use Supabase RPC to call the function
- Most robust but requires database-level changes

### **Dependencies**

- `components/profile/tabs/personal-information-tab.tsx` (primary file)
- Any other components/queries accessing `profile.email`
- Database schema/migrations
- tRPC router `auth.updateProfile` procedure

### **Integration Points**

Before implementation, must audit:
- All queries selecting from profile table
- Components receiving profile props
- API routes or tRPC procedures using profile.email
- Database schema and types generation

## 🔍 **Implementation Notes**

**Critical Questions to Answer:**
1. How many places in codebase access `profile.email`?
2. Is email frequently queried or just displayed?
3. Are there performance implications of joining auth.users?
4. Does Supabase RLS affect our ability to query auth.users?

**Edge Cases to Consider:**
- Email change confirmation flow (if implemented)
- Concurrent updates from multiple sessions
- Rollback failures in Option 2
- Migration strategy for existing data

## 📊 **Definition of Done**

- [ ] Email updates never create data drift
- [ ] All existing functionality works as expected
- [ ] Database migration completed (if needed)
- [ ] TypeScript types updated to reflect schema changes
- [ ] No regressions in profile update flow
- [ ] Error handling tested for all failure scenarios

## 🧪 **Testing Requirements**

- [ ] Unit tests for new server action/RPC (if applicable)
- [ ] Integration test: successful email update
- [ ] Integration test: auth update succeeds, profile fails
- [ ] Integration test: profile update succeeds, auth fails
- [ ] Manual test: verify email consistency after update
- [ ] Manual test: verify error messages are clear
- [ ] Edge case: test concurrent updates

## 🚫 **Out of Scope**

- Email verification/confirmation flow changes
- Password reset functionality
- Other profile fields synchronization
- Email notification system changes
- Auth provider integrations (OAuth, etc.)

## 📝 **Notes**

**From Code Review:**
> Critical issue: if Supabase auth update succeeds but the profile mutation fails, the user's auth email will be out of sync with their profile. Need transaction-like handling or rollback mechanism.

**Recommended First Step:**
Conduct thorough audit of `profile.email` usage across codebase to determine feasibility of Option 1 (removing email from profile table). This is the cleanest solution if viable.

**Alternative Consideration:**
If email must remain in profile table (e.g., for query performance, RLS policies), implement Option 3 (database function) for true atomicity.

## 🏷️ **Labels**

- `priority: high`
- `type: bug`
- `component: profile`
- `component: auth`
- `area: data-consistency`
- `requires: investigation`
