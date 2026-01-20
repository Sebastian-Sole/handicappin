# Remove Toasts and Implement Inline Feedback

## Overview

Remove all toast notifications from the application and replace them with contextual inline feedback that appears where the user is looking. This improves UX by providing feedback directly at the point of action rather than in a corner of the screen that users may not notice.

## Current State Analysis

The application uses a custom toast implementation built on `@radix-ui/react-toast`. Toasts are used across 15 components for success messages, error handling, and user feedback.

### Key Discoveries:

- Toast system defined in `components/ui/use-toast.ts` and `components/ui/toaster.tsx`
- `<Toaster />` mounted in `app/layout.tsx:107`
- 15 components use toasts with ~50+ individual toast calls
- Two toast variants: `default` (success/info) and `destructive` (error)

## Desired End State

After this plan is complete:
1. No toast notifications appear anywhere in the application
2. All feedback is shown inline near the action that triggered it
3. Buttons show loading/success/error states directly
4. Error messages appear directly below or above the relevant form/input
5. Success confirmations are either shown via button state changes or inline alerts
6. The toast system files are removed from the codebase

### Verification:
- Search for `toast(` returns 0 results
- Search for `useToast` returns 0 results
- Search for `Toaster` returns 0 results (except in history/docs)
- All forms show inline validation and submission feedback
- All buttons show appropriate loading/success states

## What We're NOT Doing

- Not adding new notification libraries (no react-hot-toast, sonner, etc.)
- Not creating a new notification center
- Not implementing snackbars or any other toast-like patterns
- Not changing the overall application layout
- Not adding animations beyond simple state transitions on buttons

## Implementation Approach

Replace toasts with three primary patterns:
1. **Button State Feedback**: Change button text/color during loading, show "✓ Done!" on success for ~2 seconds, then redirect or reset
2. **Inline Error Alerts**: Use existing `Alert` component directly in forms for errors and validation issues
3. **Redirect-based Feedback**: For actions that navigate away, use query params (e.g., `?expired=true`) so destination pages can show appropriate context

**Key Decision**: For brief success feedback (like "Scorecard submitted!"), use button state changes rather than inline alerts. This keeps the UI clean and provides feedback exactly where the user clicked.

---

## Phase 1: Create Shared Inline Feedback Components

### Overview
Create reusable components for inline feedback to ensure consistency across the application.

### Changes Required:

#### 1. Create FormFeedback Component

**File**: `components/ui/form-feedback.tsx`
**Action**: Create new file

```tsx
"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFeedbackProps {
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  className?: string;
}

export function FormFeedback({ type, title, message, className }: FormFeedbackProps) {
  const icons = {
    success: <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
    info: <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  };

  const styles = {
    success: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  };

  const textStyles = {
    success: "text-green-800 dark:text-green-200",
    error: "text-destructive",
    info: "text-blue-800 dark:text-blue-200",
  };

  return (
    <Alert className={cn(styles[type], className)}>
      {icons[type]}
      <AlertDescription className={textStyles[type]}>
        {title && <strong className="block mb-1">{title}</strong>}
        {message}
      </AlertDescription>
    </Alert>
  );
}
```

#### 2. Create SubmitButton Component with States

**File**: `components/ui/submit-button.tsx`
**Action**: Create new file

```tsx
"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends Omit<ButtonProps, "children"> {
  state: "idle" | "loading" | "success" | "error";
  idleText: string;
  loadingText: string;
  successText?: string;
  errorText?: string;
}

export function SubmitButton({
  state,
  idleText,
  loadingText,
  successText = "Done!",
  errorText = "Try Again",
  className,
  ...props
}: SubmitButtonProps) {
  const isDisabled = state === "loading" || state === "success";

  return (
    <Button
      {...props}
      disabled={isDisabled || props.disabled}
      className={cn(
        "transition-all duration-300",
        state === "success" && "bg-green-600 hover:bg-green-600",
        state === "error" && "bg-destructive hover:bg-destructive",
        className
      )}
    >
      {state === "loading" && (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      )}
      {state === "success" && (
        <>
          <Check className="mr-2 h-4 w-4" />
          {successText}
        </>
      )}
      {state === "error" && errorText}
      {state === "idle" && idleText}
    </Button>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Components render correctly in isolation

---

## Phase 2: Update Authentication Components

### Overview
Replace toasts in login, signup, forgot-password, and update-password components with inline feedback.

### Changes Required:

#### 1. Login Component

**File**: `components/auth/login.tsx`
**Changes**:
- Remove `useToast` import and usage
- Add state for feedback message
- Show inline alert for errors and info messages
- Button already shows "Signing In..." state (keep this)

Replace toast calls with:
- **Email not verified**: Show inline info alert above the form, then redirect
- **Login error**: Show inline error alert below the password field

#### 2. Signup Component

**File**: `components/auth/signup.tsx`
**Changes**:
- Remove `toast` import and usage
- Add state for feedback message
- Show inline alerts for verification and errors

Replace toast calls with:
- **Verification code sent/resent**: Show inline success alert, then redirect
- **Email already in use**: Show inline error alert below email field
- **Signup error**: Show inline error alert below form

#### 3. Forgot Password Form

**File**: `components/auth/forgot-password-form.tsx`
**Changes**:
- Remove `toast` import and usage
- Add state for feedback message
- Show inline alerts for success and errors

Replace toast calls with:
- **Configuration error**: Show inline error alert below email field
- **API error**: Show inline error alert below email field
- **Success**: Show inline success alert, then redirect
- **Network error**: Show inline error alert below email field

#### 4. Update Password Component

**File**: `components/profile/update-password.tsx`
**Changes**:
- Remove `toast` import and usage
- Add state for feedback message
- Show inline alerts for success and errors

Replace toast calls with:
- **OTP verification failed**: Show inline error alert below OTP input
- **Success**: Show inline success alert, then redirect
- **Unexpected error**: Show inline error alert below form

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Login shows error inline when credentials are wrong
- [x] Signup shows verification message inline before redirect
- [x] Forgot password shows success/error inline
- [x] Update password shows feedback inline

---

## Phase 3: Update Scorecard Components

### Overview
Replace toasts in golf scorecard, scorecard table, and add course dialog.

### Changes Required:

#### 1. Golf Scorecard Component

**File**: `components/scorecard/golf-scorecard.tsx`
**Changes**:
- Remove `toast` import and usage
- Add state for form feedback
- Show inline alerts for errors and success
- Button shows "Submitting..." state (already implemented, enhance with success state)

Replace toast calls with:
- **Add course error**: Show inline error alert in course selection area
- **Invalid scores**: Show inline error alert above scorecard table
- **Success**: Change submit button to show "✓ Submitted!" briefly, then redirect
- **Submission error**: Show inline error alert above submit button
- **Validation error**: Show inline error alert above submit button

#### 2. Scorecard Table Component

**File**: `components/scorecard/scorecard-table.tsx`
**Changes**:
- Remove `toast` import and usage
- Return validation result to parent instead of showing toast
- Parent (GolfScorecard) handles displaying the error

Replace toast calls with:
- **Negative score**: Return error to parent via callback or throw; parent shows inline error

#### 3. Add Course Dialog Component

**File**: `components/scorecard/add-course-dialog.tsx`
**Changes**:
- Remove `toast` import and usage
- Add state for form feedback
- Show inline error alert within the dialog

Replace toast calls with:
- **Form validation error**: Show inline error alert in the dialog above the save button

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Scorecard submission shows success state on button
- [x] Invalid score entry shows error inline
- [x] Add course dialog shows validation errors inline

---

## Phase 4: Update Profile Components

### Overview
Replace toasts in personal information tab, settings tab, account deletion, and data export sections.

### Changes Required:

#### 1. Personal Information Tab

**File**: `components/profile/tabs/personal-information-tab.tsx`
**Changes**:
- Remove `toast` import and usage
- Use existing success state patterns (already has `showVerifySuccess`, etc.)
- Add inline error state
- The save button already shows "Saving..." → "Saved!" states (keep this pattern)

Replace toast calls with:
- **Profile update error**: Show inline error alert below form
- **No email change**: Show inline info message near email field
- **Session expired**: Show inline error alert with login link
- **Email change code sent**: Show inline success alert (already has alert component for this)
- **Email change request error**: Show inline error alert below email section
- **Resend rate limit**: Show inline warning near resend button
- **All other email-related toasts**: Use inline alerts within the email change section

#### 2. Settings Tab

**File**: `components/profile/tabs/settings-tab.tsx`
**Changes**:
- Remove `useToast` import and usage
- Button already shows "Saving..." → "Saved!" states (keep this)
- Add inline error state for preference update errors

Replace toast calls with:
- **Email preferences update error**: Show inline error alert above save button

#### 3. Account Deletion Section

**File**: `components/profile/account-deletion-section.tsx`
**Changes**:
- Remove `useToast` import and usage
- Add state for feedback within the dialog
- Show inline alerts within the dialog

Replace toast calls with:
- **Verification code sent**: Show inline success alert in dialog
- **Deletion request error**: Show inline error alert in dialog
- **Account deleted**: Show inline success alert briefly, then redirect
- **Deletion confirmation error**: Show inline error alert in dialog
- **Invalid OTP length**: Show inline error alert below OTP input

#### 4. Data Export Section

**File**: `components/profile/data-export-section.tsx`
**Changes**:
- Remove `useToast` import and usage
- Add state for feedback
- Button already shows "Exporting..." state (enhance with success/error states)

Replace toast calls with:
- **Export failed**: Show inline error alert below button
- **Export success**: Change button to show "✓ Downloaded!" briefly, then reset

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Profile save shows success state on button
- [x] Email change shows feedback inline
- [x] Account deletion shows feedback within dialog
- [x] Data export shows success state on button

---

## Phase 5: Update Contact and Calculator Components

### Overview
Replace toasts in contact form and notify button.

### Changes Required:

#### 1. Contact Form

**File**: `components/contact/contact-form.tsx`
**Changes**:
- Remove `toast` import and usage
- The form already has an `isSubmitted` state that shows success UI (keep this!)
- Add inline error alert for errors

Replace toast calls with:
- **Message sent**: Already shows success UI via `isSubmitted` state - remove the toast call, the existing UI is sufficient
- **Too many requests**: Show inline error alert above submit button
- **Generic error**: Show inline error alert above submit button

#### 2. Notify Button

**File**: `components/calculators/notify-button.tsx`
**Changes**:
- Remove `useToast` import and usage
- Add state for feedback
- Button shows "Saving..." state (enhance with success state)

Replace toast calls with:
- **Success**: Change button to show "✓ Subscribed!" and disable it (they're now subscribed)
- **Error**: Show inline error alert below button

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Contact form shows errors inline
- [x] Notify button shows success state

---

## Phase 6: Update Billing Sync Component

### Overview
Replace toast in the BillingSync component with a redirect-based approach.

### Changes Required:

#### 1. Billing Sync Component

**File**: `components/billing-sync.tsx`
**Changes**:
- Remove `useToast` import and usage
- The component already redirects to `/upgrade` page
- The upgrade page should show appropriate messaging (it likely already does)

Replace toast calls with:
- **Subscription expired**: Redirect to `/upgrade?expired=true` - the upgrade page will detect this param and show "Your subscription has expired" messaging

#### 2. Update Upgrade Page (if needed)

**File**: `app/upgrade/page.tsx` (or relevant component)
**Changes**: Check for `expired=true` query param and show appropriate messaging

```tsx
// Check for expired param
const searchParams = useSearchParams();
const isExpired = searchParams.get("expired") === "true";

// Show messaging if expired
{isExpired && (
  <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <AlertDescription className="text-amber-800 dark:text-amber-200">
      Your premium subscription has ended. Upgrade to continue accessing premium features.
    </AlertDescription>
  </Alert>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] When subscription expires while on premium page, user is redirected to upgrade page with clear messaging

---

## Phase 7: Remove Toast System

### Overview
Remove the toast system files and the Toaster component from the layout.

### Changes Required:

#### 1. Remove Toaster from Layout

**File**: `app/layout.tsx`
**Changes**: Remove `<Toaster />` component and its import

#### 2. Delete Toast Files

**Files to delete**:
- `components/ui/toast.tsx`
- `components/ui/toaster.tsx`
- `components/ui/use-toast.ts`

#### 3. Uninstall Radix Toast Package

**Command**: `pnpm remove @radix-ui/react-toast`

#### 4. Update Any Tests

**File**: `tests/unit/components/account-deletion-section.test.tsx`
**Changes**: Update tests to verify inline feedback instead of toast calls

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm build`
- [x] Lint passes: `pnpm lint`
- [x] All tests pass: `pnpm test`
- [x] Grep for `toast(` returns 0 results in source files
- [x] Grep for `useToast` returns 0 results in source files

#### Manual Verification:
- [x] Application builds and runs without errors
- [x] No toast notifications appear anywhere
- [x] All forms and actions show inline feedback appropriately

---

## Testing Strategy

### Unit Tests:
- Test FormFeedback component renders correct variants
- Test SubmitButton component shows correct states
- Update existing component tests to verify inline feedback instead of toast calls

### Integration Tests:
- Test form submission flows show inline feedback
- Test error states display correctly

### Manual Testing Steps:
1. Sign up flow - verify inline verification message
2. Login flow - verify inline error messages
3. Forgot/update password - verify inline feedback
4. Scorecard submission - verify button states and inline errors
5. Profile updates - verify button states and inline feedback
6. Account deletion - verify dialog feedback
7. Data export - verify button states
8. Contact form - verify inline errors (success already has dedicated UI)
9. Calculator notify button - verify button state change

## Performance Considerations

- Removing the toast system reduces bundle size (eliminates @radix-ui/react-toast)
- Inline feedback is rendered only when needed (conditional rendering)
- No global state management for feedback (local component state)

## Migration Notes

- Some components already have partial inline feedback (PersonalInformationTab has success alerts)
- Button state patterns (Saving... → Saved!) are already implemented in several places
- The ContactForm already has a dedicated success UI - just needs toast removal
- The SettingsTab already has the "Saving..." → "Saved!" button pattern

## References

- Toast system: `components/ui/use-toast.ts`, `components/ui/toaster.tsx`
- Existing Alert component: `components/ui/alert.tsx`
- Similar success pattern: `components/profile/tabs/personal-information-tab.tsx:618-642`
