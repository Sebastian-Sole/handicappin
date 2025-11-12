# 0033 - Replace Browser Alerts with shadcn Dialog Component

## 🎯 **Description**

Replace all browser `alert()` calls in the PlanSelector component with the shadcn Dialog component for a more polished, professional user experience when displaying plan change confirmation messages.

## 📋 **User Story**

As a user upgrading or downgrading my subscription plan, I want to see professional, styled confirmation messages instead of browser alert dialogs so that I have a better user experience and can easily read important billing information.

## 🔧 **Technical Context**

**Current State:**
The `PlanSelector` component uses browser `alert()` in three places:
1. Line 93: Success message after subscription update (upgrade/downgrade)
2. Line 60: Error message when free plan selection fails
3. Line 31: Error message when paid plan change fails

Browser alerts are:
- Visually jarring and unprofessional
- Block the entire browser tab
- Cannot be styled to match the app design
- Don't support rich content or formatting
- Have poor accessibility

**Desired State:**
Use shadcn Dialog component (already available at `components/ui/dialog.tsx`) to display:
- Success messages with green accent
- Error messages with red accent
- Formatted text for better readability
- Non-blocking UI (user can still interact with page)
- Consistent with app's design system

## ✅ **Acceptance Criteria**

- [ ] All three `alert()` calls replaced with Dialog component
- [ ] Success dialog shows with green accent and checkmark icon
- [ ] Error dialog shows with red accent and X icon
- [ ] Dialog messages display the same content as current alerts
- [ ] Dialog auto-closes after 3 seconds OR has "OK" button to close manually
- [ ] Dialog is accessible (keyboard navigation, screen reader support)
- [ ] Dialog has smooth fade-in animation (already built into shadcn)
- [ ] No browser alerts remain in PlanSelector component

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create Reusable Notification Dialog Component**

Create `components/billing/notification-dialog.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";

interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  type: "success" | "error";
  autoCloseMs?: number;
}

export function NotificationDialog({
  open,
  onOpenChange,
  title,
  message,
  type,
  autoCloseMs = 3000,
}: NotificationDialogProps) {
  useEffect(() => {
    if (open && autoCloseMs > 0) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, autoCloseMs);

      return () => clearTimeout(timer);
    }
  }, [open, autoCloseMs, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {type === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription className="text-base pt-2">
          {message}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
```

**2. Update PlanSelector Component**

Add state for dialog:

```typescript
const [dialogState, setDialogState] = useState<{
  open: boolean;
  title: string;
  message: string;
  type: "success" | "error";
} | null>(null);
```

Replace alerts:

```typescript
// Success case (line 93)
// OLD: alert(result.message);
// NEW:
setDialogState({
  open: true,
  title: "Plan Updated",
  message: result.message,
  type: "success",
});
setTimeout(() => {
  router.push("/billing");
  router.refresh();
}, 3000); // Wait for dialog to show before redirecting

// Error case for free plan (line 60)
// OLD: alert("Failed to select free plan. Please try again.");
// NEW:
setDialogState({
  open: true,
  title: "Error",
  message: "Failed to select free plan. Please try again.",
  type: "error",
});

// Error case for paid plan (line 31)
// OLD: alert("Failed to process plan change. Please try again.");
// NEW:
setDialogState({
  open: true,
  title: "Error",
  message: "Failed to process plan change. Please try again.",
  type: "error",
});
```

Add dialog component to JSX:

```typescript
return (
  <>
    {dialogState && (
      <NotificationDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
      />
    )}

    {/* Rest of existing JSX */}
    {/* ... */}
  </>
);
```

### **Dependencies**

- `components/billing/plan-selector.tsx` - update to use Dialog
- `components/billing/notification-dialog.tsx` - create new reusable component
- `components/ui/dialog.tsx` - already exists (shadcn)
- `lucide-react` - already installed (for icons)

### **Integration Points**

- Subscription update API responses
- Error handling flows
- Navigation after successful plan changes

## 🔍 **Implementation Notes**

**Auto-close Behavior:**
- Success messages: Auto-close after 3 seconds
- Error messages: Also auto-close after 3 seconds, but user can close manually by clicking X or clicking outside
- On success, delay navigation by 3 seconds so user sees the message

**Accessibility:**
- Dialog component from shadcn already has proper ARIA attributes
- Focus trap keeps keyboard users within dialog
- Escape key closes dialog
- Screen readers announce dialog content

**Animation:**
- Shadcn dialog already includes smooth fade-in/fade-out
- No additional animation code needed

**Error Handling:**
- Keep console.error() calls for debugging
- Show user-friendly message in dialog
- Don't show technical error details to users

**Success Messages Examples:**
- "Plan upgraded! You'll be charged the prorated difference."
- "Plan change scheduled for end of billing period"
- "Subscription will cancel at the end of your billing period"

**Error Messages Examples:**
- "Failed to select free plan. Please try again."
- "Failed to process plan change. Please try again."
- "Failed to update subscription" (with more specific reason if available)

## 📊 **Definition of Done**

- [ ] NotificationDialog component created and tested
- [ ] All three alert() calls replaced with Dialog
- [ ] Success messages display with green accent
- [ ] Error messages display with red accent
- [ ] Auto-close works correctly (3 seconds)
- [ ] Manual close works (X button, outside click, Escape key)
- [ ] Navigation delay on success works (3 seconds)
- [ ] Type checking passes: `pnpm build`
- [ ] Visual QA: Dialog looks good on mobile and desktop
- [ ] Accessibility tested with keyboard navigation

## 🧪 **Testing Requirements**

### Component Tests
- [ ] NotificationDialog renders with success type
- [ ] NotificationDialog renders with error type
- [ ] NotificationDialog auto-closes after specified time
- [ ] NotificationDialog can be manually closed

### Integration Tests
- [ ] Premium → Unlimited upgrade shows success dialog
- [ ] Failed plan change shows error dialog
- [ ] Dialog doesn't block page interaction
- [ ] Multiple dialogs in sequence work correctly

### Manual Testing
1. **Test Success Flow:**
   - Premium user on `/upgrade`
   - Click "Unlimited"
   - Verify success dialog appears with green checkmark
   - Verify message is clear and formatted
   - Wait 3 seconds, verify auto-close and navigation

2. **Test Error Flow:**
   - Simulate API error (disconnect internet)
   - Try to change plan
   - Verify error dialog appears with red X
   - Verify error message is user-friendly
   - Click X button to close
   - Try again with internet, should work

3. **Test Accessibility:**
   - Tab through page, dialog should trap focus
   - Press Escape to close dialog
   - Use screen reader to verify announcements

4. **Test Responsive Design:**
   - View on mobile (dialog should be full-width)
   - View on tablet (dialog should be modal)
   - View on desktop (dialog should be centered modal)

## 🚫 **Out of Scope**

- Toast notifications (this is for important modal messages)
- Confirmation dialogs before plan changes (separate ticket)
- Loading state dialogs (separate from notifications)
- Custom animations beyond shadcn defaults
- Multiple dialogs at once (queue system)
- Undo functionality for plan changes
- Snackbar-style notifications

## 📝 **Notes**

**Design Considerations:**
- Use green (#10b981) for success
- Use red (#ef4444) for errors
- Keep messages concise (1-2 sentences max)
- Use sentence case for titles
- Icons should be 24px (h-6 w-6)

**Alternative Approaches Considered:**
1. **Alert Dialog**: More for confirmations, too heavy for notifications
2. **Toast**: Too subtle for important billing messages
3. **Inline Messages**: Would require layout changes

**Future Enhancements:**
- Add confirmation dialog BEFORE making plan changes (separate ticket)
- Add toast for less critical messages (separate ticket)
- Add progress dialog for long-running operations (separate ticket)

## 🏷️ **Labels**

- `priority: medium`
- `type: enhancement`
- `component: billing`
- `component: ui`
- `user-experience`
- `good-first-issue`
