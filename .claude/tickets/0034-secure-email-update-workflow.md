# 0034 - Secure Email Update Workflow

## 🎯 **Description**

Implement a secure email update workflow that synchronizes email changes across both `auth.users` and `public.profile` tables transactionally, with proper verification emails sent to both the new email (for verification) and old email (for security notification).

## 📋 **User Story**

As a user, I want to update my email address with confidence that:
1. Both my authentication and profile records are updated atomically
2. I must verify my new email address before it becomes active
3. I'm notified at my old email address when an email change is requested
4. The change only takes effect after verification

## 🔧 **Technical Context**

Currently, the email update flow in `components/profile/tabs/personal-information-tab.tsx:75-96` has several issues:
1. Updates `auth.users` email via `supabase.auth.updateUser()` (line 77-79)
2. Separately updates `public.profile` via tRPC mutation (line 91-95)
3. These operations are **not transactional** - one could succeed while the other fails
4. No verification flow for the new email
5. No security notification to the old email
6. Email field is currently disabled (line 138), requiring users to contact support

The profile table has a `verified` field (db/schema.ts:35) which could be leveraged for email verification status tracking.

## ✅ **Acceptance Criteria**

- [ ] Email field is enabled in the personal information form
- [ ] Updating email triggers verification workflow (does not immediately update email)
- [ ] Verification email sent to **new** email address with unique token
- [ ] Security notification email sent to **old** email address
- [ ] Email in both `auth.users` and `public.profile` only updates after verification
- [ ] Update is atomic/transactional (both tables update together or rollback)
- [ ] Pending email changes are tracked separately from current email
- [ ] User can cancel pending email change
- [ ] Expired verification tokens (24-48 hours) are handled gracefully
- [ ] Clear UI feedback during pending verification state

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Database Schema Updates (`db/schema.ts`)**

Add to profile table:
```typescript
// Email change tracking
pendingEmail: text("pending_email"),
pendingEmailToken: text("pending_email_token"),
pendingEmailExpiresAt: timestamp("pending_email_expires_at"),
emailUpdatedAt: timestamp("email_updated_at"),
```

**2. Email Templates**

Create two new React Email templates in `/emails/`:

- `email-verification-change.tsx` - Sent to NEW email
  - Subject: "Verify your new email address"
  - Include verification link with token
  - Explain what happens after verification
  - Link expires in 24-48 hours

- `email-change-notification.tsx` - Sent to OLD email
  - Subject: "Email change requested for your account"
  - Inform user of pending email change
  - Include "I didn't request this" link to cancel
  - Security best practice notification

**3. Email Service Functions (`lib/email-service.ts`)**

Add two new functions following existing patterns:
```typescript
export async function sendEmailChangeVerification({
  to: string,              // NEW email
  token: string,
  oldEmail: string,        // For context in email
  verificationUrl: string,
}): Promise<SendEmailResult>

export async function sendEmailChangeNotification({
  to: string,              // OLD email
  newEmail: string,        // Partially masked, e.g., ne****@example.com
  cancelUrl: string,
}): Promise<SendEmailResult>
```

**4. Backend API Endpoint**

Create new tRPC mutation `auth.requestEmailChange`:
```typescript
// In server/api/routers/auth.ts
requestEmailChange: authedProcedure
  .input(z.object({
    userId: z.string().uuid(),
    newEmail: z.string().email(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Validate new email not already in use
    // 2. Generate secure token (crypto.randomBytes)
    // 3. Update profile with pending_email, token, expires_at
    // 4. Send verification email to NEW email
    // 5. Send notification email to OLD email
    // 6. Return success with instructions
  })
```

Create new public page `/verify-email-change/page.tsx`:
```typescript
// Handles verification token from email link
// Query params: token, userId
// On success:
//   - Verify token validity and expiration
//   - Begin transaction:
//     - Update auth.users email via admin API
//     - Update profile.email
//     - Clear pending_email fields
//     - Set email_updated_at
//     - Commit or rollback
//   - Show success message
```

Create new API route `/api/auth/cancel-email-change/route.ts`:
```typescript
// Handles cancel request from old email notification
// Query params: token, userId
// Clears pending_email fields
// Shows cancellation confirmation
```

**5. Transactional Update Strategy**

Since Supabase auth.updateUser() cannot be part of a database transaction, use this approach:

**Option A: Database Trigger (Recommended)**
```sql
-- Create trigger on profile.email update
-- When profile.email changes:
--   1. Validate user is authenticated
--   2. Use auth.admin API via pg_net to update auth.users
--   3. If admin API fails, raise exception to rollback profile update
```

**Option B: Two-Phase Update with Rollback**
```typescript
// In verification handler:
// 1. Update profile.email in transaction
// 2. Call auth.admin.updateUser() with service role
// 3. If auth update fails:
//    - Rollback profile update
//    - Log error to Sentry
//    - Show user error message
```

**Option C: Use Supabase Admin API with Service Role**
```typescript
// Service role can update both auth.users and public tables
// Wrap in try-catch to simulate transactional behavior
// Use database transaction for profile, rollback if auth fails
```

**6. Frontend Updates**

Update `components/profile/tabs/personal-information-tab.tsx`:
```typescript
// Line 138: Remove 'disabled' from email input
// Add pendingEmail state display
// Change form submission to call requestEmailChange instead of updateUser
// Show pending verification UI when pendingEmail exists
// Add "Cancel email change" button when applicable
```

**7. Security Considerations**

- Generate cryptographically secure tokens (32+ bytes)
- Token expiration: 24-48 hours
- Rate limiting on email change requests (1 per hour max)
- Validate new email not already in use by another account
- Log all email change attempts (success and failures) to Sentry
- Mask email addresses in notifications (ne****@example.com)
- Prevent email enumeration attacks
- CSRF protection on verification endpoints

### **Dependencies**

- `db/schema.ts` - Profile table schema
- `components/profile/tabs/personal-information-tab.tsx` - Email form UI
- `server/api/routers/auth.ts` - tRPC router
- `lib/email-service.ts` - Email sending functions
- `/emails/` directory - Email templates
- Supabase Auth Admin API (service role)
- Resend email service
- Database migrations (Drizzle)

### **Integration Points**

- Supabase Auth (auth.users table) - Source of truth for authentication email
- Profile table (public.profile) - Mirror of email for queries/joins
- Email service (Resend) - Delivery mechanism
- Edge function for sending verification email hook (if needed)
- RLS policies - Ensure users can only change their own email

## 🔍 **Implementation Notes**

### **Email Synchronization Strategy**

The `auth.users` table in the `auth` schema is the **source of truth** for authentication. The `profile.email` field exists for:
- Easier querying without auth schema access
- Display purposes in UI
- Historical reference

Both must stay synchronized. When email verification completes:
1. Update `auth.users.email` first (using admin API)
2. Then update `profile.email` in same flow
3. If either fails, rollback/retry

### **Verification Token Flow**

1. User submits new email
2. Token generated: `crypto.randomBytes(32).toString('hex')`
3. Token stored hashed in `pending_email_token`
4. Verification URL: `/verify-email-change?token={token}&userId={userId}`
5. On verification:
   - Hash incoming token
   - Compare with stored hash
   - Check expiration
   - Execute transactional update

### **Edge Cases to Handle**

1. **User changes email multiple times before verifying**
   - Invalidate previous pending email/token
   - Only latest request is valid

2. **Verification token expires**
   - Clear pending_email fields
   - User must re-request email change
   - Show helpful error message

3. **New email already in use**
   - Prevent request, show error
   - Prevent email enumeration (generic error)

4. **User clicks "Cancel" from old email**
   - Clear pending_email fields
   - Send confirmation to old email
   - Log security event

5. **User loses access to old email**
   - Support override process needed (out of scope)
   - Document support process

6. **Database update succeeds, auth.updateUser fails**
   - Log to Sentry with full context
   - Automatic retry mechanism
   - Admin reconciliation job (future ticket)

### **Existing Patterns to Follow**

- Email templates: Follow `emails/welcome.tsx` structure
- Email service: Follow pattern in `lib/email-service.ts:218-267`
- Verification flow: Reference `supabase/functions/send-verification-email/`
- Form handling: Match existing form patterns in personal-information-tab

### **Database Migration Example**

```sql
-- Add email change tracking columns
ALTER TABLE public.profile
  ADD COLUMN pending_email TEXT,
  ADD COLUMN pending_email_token TEXT,
  ADD COLUMN pending_email_expires_at TIMESTAMPTZ,
  ADD COLUMN email_updated_at TIMESTAMPTZ;

-- Add index for token lookups
CREATE INDEX idx_profile_pending_email_token
  ON public.profile(pending_email_token)
  WHERE pending_email_token IS NOT NULL;

-- Add check constraint for token expiration
ALTER TABLE public.profile
  ADD CONSTRAINT pending_email_token_requires_email
  CHECK (
    (pending_email IS NULL AND pending_email_token IS NULL AND pending_email_expires_at IS NULL)
    OR
    (pending_email IS NOT NULL AND pending_email_token IS NOT NULL AND pending_email_expires_at IS NOT NULL)
  );
```

## 📊 **Definition of Done**

- [ ] Database migration applied and verified
- [ ] Email change form enabled and functional
- [ ] Both verification and notification emails send successfully
- [ ] Email verification completes and updates both tables
- [ ] Cancel email change works from notification email
- [ ] Expired tokens handled gracefully
- [ ] All edge cases handled (see Implementation Notes)
- [ ] No race conditions or partial updates
- [ ] Security considerations implemented (rate limiting, token security)
- [ ] Error handling with proper user feedback
- [ ] Logging to Sentry for monitoring
- [ ] No TypeScript errors
- [ ] RLS policies enforced

## 🧪 **Testing Requirements**

### **Unit Tests**
- [ ] Token generation produces cryptographically secure tokens
- [ ] Token expiration validation logic
- [ ] Email masking function (ne****@example.com)
- [ ] Validation: new email not already in use

### **Integration Tests**
- [ ] Request email change → sends both emails
- [ ] Verify email change → updates both tables atomically
- [ ] Cancel email change → clears pending state
- [ ] Expired token → returns appropriate error
- [ ] Multiple email change requests → latest wins
- [ ] Email already in use → prevents request

### **Manual Testing**
- [ ] Full flow: request → verify → confirmed
- [ ] Full flow: request → cancel → cancelled
- [ ] Expired token handling
- [ ] UI states (idle, pending, verified)
- [ ] Email content renders correctly (both templates)
- [ ] Links in emails work correctly

### **Security Testing**
- [ ] Rate limiting prevents abuse
- [ ] Tokens cannot be guessed
- [ ] Cannot verify someone else's email change
- [ ] Cannot enumerate existing emails
- [ ] CSRF protection on endpoints

### **Error Scenarios**
- [ ] Database update fails → proper rollback
- [ ] Auth API fails → proper rollback
- [ ] Email service fails → user notified, can retry
- [ ] Network timeout → graceful degradation

## 🚫 **Out of Scope**

- **Support override process** - When user loses access to old email (manual admin process)
- **Email change history** - Audit log of past email changes (future enhancement)
- **2FA for email changes** - Additional security layer (future consideration)
- **Automatic reconciliation job** - Background job to sync mismatched emails (future ticket)
- **Email verification reminders** - Reminder email if verification not completed (future enhancement)
- **Magic link authentication** - Alternative to email/password (separate feature)
- **Social auth email updates** - Updating email from OAuth providers (separate ticket)

## 📝 **Notes**

### **Why This Matters**

Currently, users must contact support to change their email (line 141-149 in personal-information-tab.tsx). This creates:
- Poor user experience
- Support team burden
- Delayed email updates
- Security concerns (support changing email without verification)

This ticket implements industry-standard email change flow with:
- Self-service capability
- Security notifications
- Verification requirements
- Atomic updates preventing data inconsistency

### **Future Enhancements**

After this ticket is complete, consider:
1. **Ticket 0035**: Email change audit log
2. **Ticket 0036**: Automatic email sync reconciliation job
3. **Ticket 0037**: 2FA requirement for email changes
4. **Ticket 0038**: Email verification reminders

### **Related Tickets**

- #0030 - Email Preferences Storage (complements this ticket)
- #0032 - Add Sentry to Edge Functions (logging infrastructure)
- #0024 - Remove PII from Logs (ensure email change logs are redacted)

### **Supabase Auth Hooks**

Consider using Supabase Auth Hooks for email change events:
- Similar to `send-verification-email` edge function
- Hook: `auth.email_change` event
- Can enforce custom validation or logging
- Reference: https://supabase.com/docs/guides/auth/auth-hooks

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: authentication`
- `component: profile`
- `component: email`
- `area: security`
- `complexity: high`
- `estimated-effort: 2-3 days`
