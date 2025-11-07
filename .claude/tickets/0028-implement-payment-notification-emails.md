# 0028 - Implement Payment Notification Emails

## 🎯 **Description**

Implement email notifications for critical payment events (payment failures, refunds, and failed purchases) to keep users informed about their billing status.

## 📋 **User Story**

As a user, I want to receive email notifications when my payment fails, when I receive a refund, or when a purchase attempt fails so that I understand my account status and can take appropriate action.

## 🔧 **Technical Context**

Currently, the webhook handlers at `app/api/stripe/webhook/route.ts` process payment events but don't notify users. There are TODO comments at:
- Line 633: Failed payment notifications
- Line 720: Invoice payment failure alerts
- Line 820: Refund notifications

Users are left unaware of critical billing events, leading to confusion about access loss or payment issues.

## ✅ **Acceptance Criteria**

- [ ] Email sent when payment intent fails (handlePaymentIntentFailed)
- [ ] Email sent when invoice payment fails with retry information (handleInvoicePaymentFailed)
- [ ] Email sent when charge is refunded (handleChargeRefunded)
- [ ] Emails are user-friendly and explain next steps
- [ ] Emails include relevant transaction details (amount, date, reason)
- [ ] Email delivery failures are logged but don't break webhook processing

## 🚨 **Technical Requirements**

### **Implementation Details**

Choose and integrate an email service provider (e.g., Resend, SendGrid, AWS SES, Postmark).

Create email templates for:
1. **Payment failed** - Inform user their payment didn't go through
2. **Invoice payment failed** - Include attempt count and next retry date
3. **Refund processed** - Confirm refund amount and expected timeline

### **Dependencies**

- Email service API credentials
- Email templates (HTML/text)
- User email lookup from profile table
- Integration with existing webhook handlers

### **Integration Points**

Webhook handlers:
- `handlePaymentIntentFailed` (line 599-640)
- `handleInvoicePaymentFailed` (line 646-731)
- `handleChargeRefunded` (line 737-839)

## 🔍 **Implementation Notes**

- Wrap email sending in try-catch to prevent webhook failures
- Log all email attempts (success/failure) for debugging
- Consider email rate limiting to prevent abuse
- Support both HTML and plain text email formats
- Include unsubscribe link for transactional emails (legal requirement)

## 📊 **Definition of Done**

- [ ] Email service integrated and configured
- [ ] All three email types implemented and tested
- [ ] Email templates are mobile-responsive
- [ ] Error handling prevents webhook failures from email issues
- [ ] Logging includes email delivery status

## 🧪 **Testing Requirements**

- [ ] Test emails for each scenario in development
- [ ] Verify email delivery in test mode
- [ ] Test error handling when email service is down
- [ ] Validate email content and formatting across email clients
- [ ] Confirm webhook still succeeds if email fails

## 🚫 **Out of Scope**

- Marketing emails or newsletters
- Email preference management UI
- Email open/click tracking
- Batch email sending
- Email template builder UI

## 📝 **Notes**

Consider starting with Resend as it has a generous free tier and simple API. Keep email copy concise and action-oriented.

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: billing`
- `component: notifications`
- `user-facing`
