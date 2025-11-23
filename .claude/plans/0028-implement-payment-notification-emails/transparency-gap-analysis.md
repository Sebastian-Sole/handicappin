# User Transparency Gap Analysis

**Date**: 2025-11-19
**Context**: Stripe Dashboard emails now enabled per Phase 0
**Goal**: Determine which custom email notifications are still needed

---

## Current State: What Stripe Now Handles (After Dashboard Configuration)

Since you've enabled Stripe's built-in emails, users now automatically receive:

### ✅ Covered by Stripe:

1. **Subscription Payment Failures** (`invoice.payment_failed`)
   - Stripe sends automatic email when recurring payment declines
   - Includes: Failure reason, retry date, "Update Payment Method" link
   - Sent on each retry attempt (up to 4 attempts over 3 weeks)

2. **Refund Notifications** (`charge.refunded`)
   - Stripe sends refund receipt automatically
   - Includes: Refund amount, original charge details, timeline

3. **Successful Payment Receipts**
   - Stripe Checkout sends receipt for successful payments
   - Includes: Invoice PDF, amount paid, payment method

4. **Subscription Cancellation Confirmation**
   - Stripe sends email when subscription is cancelled
   - Includes: Cancellation date, final billing date

---

## Remaining Gaps: What Stripe Does NOT Handle

### 🔴 Critical Gaps (Must Implement)

#### 1. One-Time Payment Failures (Lifetime Plan)
**Event**: `payment_intent.payment_failed`
**Scenario**: User purchases lifetime plan, but payment declines

**Why Stripe Doesn't Handle It**:
- Stripe Checkout shows error on-screen
- BUT: No email is sent for failed one-time payments
- If user closes browser before seeing error, they're left wondering why they don't have access

**User Impact**: HIGH
- User paid (or tried to) but doesn't have access
- No notification explaining why
- May contact support frustrated

**Frequency**: Estimated 2-3% of lifetime purchases fail
**Priority**: 🔴 **HIGH**

---

### 🟡 Important Gaps (Improve User Experience)

#### 2. Subscription Change Confirmations
**Events**: Manual plan changes (upgrade/downgrade)
**Scenario**: User changes from Premium to Unlimited (or vice versa)

**Why Stripe Doesn't Handle It**:
- Stripe only sends emails for subscription lifecycle events (create/cancel/fail)
- Mid-cycle plan changes don't trigger Stripe emails
- User only sees browser `alert()` popup (easily dismissed/missed)

**User Impact**: MEDIUM
- No paper trail of plan changes
- User forgets what plan they selected
- Unclear when downgrade will take effect
- No confirmation of prorated charges

**Current Workaround**:
- UI shows `alert()`: "Plan upgraded! You'll be charged the prorated difference."
- Billing page shows new plan immediately

**Gap**:
- Alert is dismissible (no record)
- No email confirmation with details
- No reminder before downgrade takes effect

**Priority**: 🟡 **MEDIUM**

#### 3. Welcome/Onboarding Emails
**Events**: First successful subscription purchase
**Scenario**: User completes Premium/Unlimited signup

**Why Stripe Doesn't Handle It**:
- Stripe sends payment receipt, but not a "Welcome to Premium" email
- No onboarding guidance or feature highlight

**User Impact**: MEDIUM
- Missed opportunity to educate user about features
- No clear "next steps" after purchase
- Less engagement with premium features

**Current Workaround**:
- `/billing/success` page shows "Welcome to Premium!" UI
- Auto-redirects to dashboard after 3 seconds
- User might miss the message

**Priority**: 🟡 **MEDIUM** (nice-to-have, not critical)

---

### 🟢 Low Priority Gaps (Edge Cases)

#### 4. Dispute Notifications (Admin)
**Event**: `charge.dispute.created`
**Scenario**: Customer files chargeback/dispute

**Why Stripe Doesn't Handle It**:
- Stripe emails the **merchant** (you), not the customer
- This is an admin alert, not user notification

**User Impact**: NONE (admin-facing)
**Admin Impact**: HIGH (fraud detection)

**Current Workaround**:
- Webhook logs to console (line 1045 in webhook handler)
- TODO comment for admin alert (line 1069)

**Priority**: 🟢 **LOW** (separate ticket, not user-facing transparency)

#### 5. Payment Method Update Confirmations
**Event**: User updates card in Stripe Customer Portal
**Scenario**: User changes payment method

**Why Stripe Doesn't Handle It**:
- Stripe **does NOT send webhook** for payment method updates
- Cannot detect when user changes card
- This is a Stripe limitation

**User Impact**: LOW
- User just updated it themselves, so they know
- Email would be redundant

**Priority**: 🟢 **LOW** (not actionable - Stripe limitation)

---

## Prioritized Implementation List

Based on user transparency needs (not redundant with Stripe):

### Phase 1: Critical User Transparency (Must-Have)

1. **One-Time Payment Failure Notification** 🔴
   - Event: `payment_intent.payment_failed`
   - When: Lifetime plan purchase fails
   - Content:
     - "Your payment for Handicappin' Lifetime could not be processed"
     - Payment decline reason (if available)
     - Amount attempted
     - "Update Payment Method" link or "Try Again" link
   - **Estimated Effort**: 4-6 hours

### Phase 2: Enhanced User Experience (Should-Have)

2. **Subscription Change Confirmations** 🟡
   - Events:
     - Manual upgrade (immediate)
     - Manual downgrade (end of period)
     - Cancellation (end of period)
   - When: User changes plan via `/upgrade` page
   - Content:
     - Current plan → New plan
     - Effective date (immediate vs. end of period)
     - Prorated charge amount (upgrades)
     - What features they'll gain/lose
     - Cancellation reminder 3 days before downgrade
   - **Estimated Effort**: 6-8 hours (multiple email types)

3. **Welcome Email** 🟡
   - Event: First successful subscription (not one-time lifetime)
   - When: `checkout.session.completed` for new subscriptions
   - Content:
     - "Welcome to Handicappin' Premium!"
     - Features overview
     - "Get Started" guide
     - Link to dashboard
   - **Estimated Effort**: 3-4 hours

### Phase 3: Edge Cases & Admin Alerts (Nice-to-Have)

4. **Dispute Admin Alert** 🟢
   - Event: `charge.dispute.created`
   - Audience: Admin/operations team
   - Content: Security alert with user details
   - **Estimated Effort**: 2-3 hours
   - **Note**: This is admin-facing, not user transparency

---

## Why These Are Still Needed (Despite Stripe Emails)

### Branding & Trust
- Stripe emails say "from Stripe" (not "from Handicappin'")
- Custom emails build brand consistency
- Shows you care about communication

### Actionable Context
- Stripe emails are generic
- Custom emails can include app-specific links:
  - "View Your Billing Dashboard" → your `/billing` page
  - "Update Payment Method" → your Stripe portal with return URL
  - "Contact Support" → pre-filled with session ID

### Lifecycle Clarity
- Stripe emails focus on payment transactions
- Custom emails explain **app access changes**:
  - "Your Premium access will end on [date]"
  - "You now have Unlimited rounds!"
  - "Your payment failed - here's how to fix it"

### Transparency Beyond Transactions
- Stripe handles money movement
- You handle **subscription state changes** (plan selected, access granted)
- Users need to understand BOTH:
  - ✅ Payment processed (Stripe)
  - ✅ Access granted (You)

---

## Email Architecture Decision

Given that:
- Resend is already integrated (in Supabase Edge Functions)
- React Email templates exist (for auth)
- Webhook handlers run in Next.js (not Edge Functions)

### Recommended Architecture:

**Option: Create Centralized Email Service in Next.js**

**File**: `lib/email-service.ts`

**Why**:
- Webhooks can send emails directly (no HTTP call to Edge Function)
- Consolidates all billing emails in one place
- Easier error handling and logging
- Consistent with Next.js app architecture

**How**:
```typescript
// lib/email-service.ts
import { Resend } from 'resend';
import { render } from '@react-email/components';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPaymentFailedEmail(params: {
  to: string;
  amount: number;
  reason: string;
  portalUrl: string;
}) {
  const html = await render(<PaymentFailedEmail {...params} />);

  return await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Handicappin' <sebastiansole@handicappin.com>",
    to: params.to,
    subject: "Payment Failed - Action Required",
    html,
  });
}
```

**Templates**: `emails/` directory (new)
- `payment-failed.tsx`
- `subscription-changed.tsx`
- `welcome.tsx`

**Pattern**: Same as existing auth email templates, just in Next.js instead of Edge Functions

---

## Questions Answered

### Q: "Do we need custom emails if Stripe already sends them?"

**A**: For 2 out of 3 events in the original ticket, **NO** (redundant).

But for:
- ✅ One-time payment failures: **YES** (Stripe doesn't send)
- ✅ Subscription changes: **YES** (Stripe doesn't send for mid-cycle changes)
- ✅ Welcome emails: **YES** (Stripe sends receipt, not onboarding)

### Q: "What's the priority order?"

**A**:
1. 🔴 **One-time payment failures** (critical gap)
2. 🟡 **Subscription change confirmations** (UX improvement)
3. 🟡 **Welcome emails** (nice-to-have)
4. 🟢 **Admin dispute alerts** (separate concern, not user-facing)

### Q: "How much work is this really?"

**A**:
- Phase 1 (payment failures only): **4-6 hours**
- Phase 2 (+ subscription changes + welcome): **+9-12 hours** = **13-18 hours total**
- Original ticket estimate: 16-24 hours

**Revised estimate is accurate**, but scope is now **focused on genuine gaps** (not redundant work).

### Q: "Should we implement all of them?"

**A**: **Start with Phase 1** (payment failures), then assess:
- If support tickets decrease → Phase 1 was sufficient
- If users still complain about lack of confirmation → Add Phase 2
- If onboarding engagement is low → Add welcome emails

**Iterative approach** beats big-bang implementation.

---

## Success Metrics

To validate the need for each email type, track:

### Phase 1 Metrics (Payment Failures):
- Lifetime purchase failure rate (Stripe Dashboard)
- Support tickets: "Why don't I have access?" (before/after)
- Email open rate (Resend Dashboard)
- Email click-through rate ("Update Payment Method" link)

**Target**: Reduce "no access" support tickets by 80%

### Phase 2 Metrics (Subscription Changes):
- Plan change frequency (database query)
- Support tickets: "What plan am I on?" or "When does my plan change?"
- Email engagement rate

**Target**: Zero confusion about plan status

### Phase 3 Metrics (Welcome Emails):
- New subscriber count
- Feature adoption rate (% of premium users who track rounds)
- Email click-through to dashboard

**Target**: Increase feature adoption by 20%

---

## Implementation Checklist (Phase 1 Only)

Before implementing payment failure emails:

- [ ] Verify `RESEND_API_KEY` is set in Next.js environment (`.env.local`)
- [ ] Verify `handicappin.com` domain is verified in Resend Dashboard
- [ ] Check SPF/DKIM DNS records are published
- [ ] Create `lib/email-service.ts` email utility
- [ ] Create `emails/payment-failed.tsx` template
- [ ] Test email in development: `pnpm email`
- [ ] Integrate with `handlePaymentIntentFailed` webhook handler
- [ ] Add error handling (don't break webhook on email failure)
- [ ] Test with Stripe CLI: `stripe trigger payment_intent.payment_failed`
- [ ] Monitor Resend Dashboard for delivery issues
- [ ] Track support ticket volume change

---

## Final Recommendation

**Implement Phase 1 immediately** (one-time payment failures):
- This is a **genuine gap** in user transparency
- Stripe does NOT handle this event
- **Estimated effort**: 4-6 hours
- **High impact**: Prevents user frustration

**Defer Phase 2 & 3** until validated:
- Monitor metrics for 2-4 weeks
- If no user complaints about lack of confirmation emails, defer
- If support tickets indicate confusion, implement Phase 2

**This is the minimal viable solution** that addresses the critical transparency gap without over-engineering.
