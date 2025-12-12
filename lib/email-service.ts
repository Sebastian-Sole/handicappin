import { Resend } from "resend";
import { render } from "@react-email/components";
import SubscriptionUpgradedEmail from "@/emails/subscription-upgraded";
import SubscriptionDowngradedEmail from "@/emails/subscription-downgraded";
import SubscriptionCancelledEmail from "@/emails/subscription-cancelled";
import WelcomeEmail from "@/emails/welcome";
import EmailVerificationChange from "@/emails/email-verification-change";
import EmailChangeNotification from "@/emails/email-change-notification";
import {
  logWebhookInfo,
  logWebhookError,
  logWebhookSuccess,
} from "./webhook-logger";
import { maskEmail, redactEmail } from "./logging";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "Handicappin' <sebastiansole@handicappin.com>";

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send subscription upgraded notification to user
 */
export async function sendSubscriptionUpgradedEmail({
  to,
  oldPlan,
  newPlan,
  proratedCharge,
  currency,
  billingUrl,
}: {
  to: string;
  oldPlan: string;
  newPlan: string;
  proratedCharge: number;
  currency: string;
  billingUrl: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending subscription upgraded email to ${redactEmail(to)}`);

    const emailHtml = await render(
      SubscriptionUpgradedEmail({
        oldPlan,
        newPlan,
        proratedCharge,
        currency,
        billingUrl,
        supportEmail: "sebastiansole@handicappin.com",
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your plan has been upgraded to ${
        newPlan.charAt(0).toUpperCase() + newPlan.slice(1)
      }!`,
      html: emailHtml,
    });

    logWebhookSuccess(
      `Subscription upgraded email sent successfully to ${redactEmail(to)}`,
      {
        messageId: result.data?.id,
        oldPlan,
        newPlan,
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send subscription upgraded email to ${redactEmail(to)} (${oldPlan} → ${newPlan})`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send subscription downgraded notification to user
 */
export async function sendSubscriptionDowngradedEmail({
  to,
  oldPlan,
  newPlan,
  effectiveDate,
  billingUrl,
}: {
  to: string;
  oldPlan: string;
  newPlan: string;
  effectiveDate: Date;
  billingUrl: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending subscription downgraded email to ${redactEmail(to)}`);

    const emailHtml = await render(
      SubscriptionDowngradedEmail({
        oldPlan,
        newPlan,
        effectiveDate,
        billingUrl,
        supportEmail: "sebastiansole@handicappin.com",
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Your plan will change to ${
        newPlan.charAt(0).toUpperCase() + newPlan.slice(1)
      }`,
      html: emailHtml,
    });

    logWebhookSuccess(
      `Subscription downgraded email sent successfully to ${redactEmail(to)}`,
      {
        messageId: result.data?.id,
        oldPlan,
        newPlan,
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send subscription downgraded email to ${redactEmail(to)} (${oldPlan} → ${newPlan})`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send subscription cancelled notification to user
 */
export async function sendSubscriptionCancelledEmail({
  to,
  plan,
  endDate,
  billingUrl,
}: {
  to: string;
  plan: string;
  endDate: Date;
  billingUrl: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending subscription cancelled email to ${redactEmail(to)}`);

    const emailHtml = await render(
      SubscriptionCancelledEmail({
        plan,
        endDate,
        billingUrl,
        supportEmail: "sebastiansole@handicappin.com",
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Your subscription has been cancelled",
      html: emailHtml,
    });

    logWebhookSuccess(
      `Subscription cancelled email sent successfully to ${redactEmail(to)}`,
      {
        messageId: result.data?.id,
        plan,
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send subscription cancelled email to ${redactEmail(to)} (plan: ${plan})`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send welcome email to new subscribers
 * Used when user completes first-time subscription
 */
export async function sendWelcomeEmail({
  to,
  plan,
  dashboardUrl,
}: {
  to: string;
  plan: string;
  dashboardUrl: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending welcome email to ${redactEmail(to)}`);

    const emailHtml = await render(
      WelcomeEmail({
        plan,
        redirectUrl: dashboardUrl,
        supportEmail: "sebastiansole@handicappin.com",
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Welcome to Handicappin' ${
        plan.charAt(0).toUpperCase() + plan.slice(1)
      }!`,
      html: emailHtml,
    });

    logWebhookSuccess(`Welcome email sent successfully to ${redactEmail(to)}`, {
      messageId: result.data?.id,
      plan,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send welcome email to ${redactEmail(to)} (plan: ${plan})`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send email change verification to NEW email address
 * User must click verification link to complete email change
 */
export async function sendEmailChangeVerification({
  to,
  verificationUrl,
  oldEmail,
  newEmail,
}: {
  to: string;
  verificationUrl: string;
  oldEmail: string;
  newEmail: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending email change verification to ${redactEmail(to)}`);

    const emailHtml = await render(
      EmailVerificationChange({
        verificationUrl,
        oldEmail,
        newEmail,
        expiresInHours: 48,
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Verify your new email address",
      html: emailHtml,
    });

    logWebhookSuccess(
      `Email change verification sent successfully to ${redactEmail(to)}`,
      {
        messageId: result.data?.id,
        oldEmail: redactEmail(oldEmail),
        newEmail: redactEmail(newEmail),
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send email change verification to ${redactEmail(to)}`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send email change notification to OLD email address
 * Notifies user of pending email change with cancel option
 */
export async function sendEmailChangeNotification({
  to,
  cancelUrl,
  newEmail,
}: {
  to: string;
  cancelUrl: string;
  newEmail: string; // Will be masked before sending
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending email change notification to ${redactEmail(to)}`);

    const emailHtml = await render(
      EmailChangeNotification({
        cancelUrl,
        newEmail: maskEmail(newEmail), // Mask the new email
        oldEmail: to,
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Email change requested for your account",
      html: emailHtml,
    });

    logWebhookSuccess(
      `Email change notification sent successfully to ${redactEmail(to)}`,
      {
        messageId: result.data?.id,
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send email change notification to ${redactEmail(to)}`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
