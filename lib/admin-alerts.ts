/**
 * Admin alerting for critical webhook failures
 * Sends email notifications when webhooks fail 3+ times
 */

export interface WebhookFailureAlert {
  userId: string;
  eventId: string;
  eventType: string;
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  errorMessage: string;
  retryCount: number;
  timestamp: Date;
}

/**
 * Determine if admin should be alerted
 * Alert on 3rd failure (Stripe will retry ~4 times total)
 */
export function shouldAlertAdmin(retryCount: number): boolean {
  return retryCount >= 3;
}

/**
 * Send email alert to admin for critical webhook failure
 * Uses simple fetch to email API endpoint
 */
export async function sendAdminWebhookAlert(failure: WebhookFailureAlert): Promise<void> {
  const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',') || ['sebastiansole@handicappin.com'];

  const subject = `🚨 CRITICAL: Webhook Failed ${failure.retryCount} Times`;

  const body = `
CRITICAL: User Paid But Webhook Failed

User ID: ${failure.userId}
Event Type: ${failure.eventType}
Event ID: ${failure.eventId}
Error: ${failure.errorMessage}
Retry Count: ${failure.retryCount}
Timestamp: ${failure.timestamp.toISOString()}

Stripe Dashboard Links:
${failure.sessionId ? `- Session: https://dashboard.stripe.com/test/checkout/sessions/${failure.sessionId}` : ''}
${failure.customerId ? `- Customer: https://dashboard.stripe.com/test/customers/${failure.customerId}` : ''}
${failure.subscriptionId ? `- Subscription: https://dashboard.stripe.com/test/subscriptions/${failure.subscriptionId}` : ''}

Database:
- User Profile: /dashboard/${failure.userId}
- Webhook Events: Check webhook_events table for event_id='${failure.eventId}'

Recommended Actions:
1. Check Stripe dashboard to verify payment was captured
2. Check webhook_events table for full error details
3. Check user's profile.plan_selected in database
4. If payment captured but plan not updated, reconciliation job will fix within 24h
5. For immediate fix, manually update profile.plan_selected in database

This alert fires after 3 failed webhook attempts. Stripe will retry once more.
The daily reconciliation job will catch any discrepancies within 24 hours.
`;

  // Log to console with high visibility
  console.error('═══════════════════════════════════════════');
  console.error('🚨 CRITICAL WEBHOOK FAILURE - ADMIN ALERT');
  console.error('═══════════════════════════════════════════');
  console.error(`User ID: ${failure.userId}`);
  console.error(`Event Type: ${failure.eventType}`);
  console.error(`Retry Count: ${failure.retryCount}`);
  console.error(`Error: ${failure.errorMessage}`);
  console.error('═══════════════════════════════════════════');

  // Send email via your email service
  // TODO: Implement email sending based on your email provider
  // Options:
  // 1. Resend (recommended for Next.js)
  // 2. SendGrid
  // 3. AWS SES
  // 4. Postmark

  try {
    // Example with fetch to email API endpoint (implement based on your setup)
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/send-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: adminEmails,
        subject,
        body,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send admin alert email:', response.statusText);
    } else {
      console.log('✅ Admin alert email sent successfully');
    }
  } catch (error) {
    // Don't throw - email failure shouldn't break webhook processing
    console.error('Error sending admin alert email:', error);
  }
}
