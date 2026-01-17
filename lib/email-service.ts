import { Resend } from "resend";
import { render } from "@react-email/components";
import SubscriptionUpgradedEmail from "@/emails/subscription-upgraded";
import SubscriptionDowngradedEmail from "@/emails/subscription-downgraded";
import SubscriptionCancelledEmail from "@/emails/subscription-cancelled";
import WelcomeEmail from "@/emails/welcome";
import ContactFormEmail from "@/emails/contact-form";
import ContactConfirmationEmail from "@/emails/contact-confirmation";
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
      `Failed to send subscription upgraded email to ${redactEmail(
        to
      )} (${oldPlan} → ${newPlan})`,
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
    logWebhookInfo(
      `Sending subscription downgraded email to ${redactEmail(to)}`
    );

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
      `Failed to send subscription downgraded email to ${redactEmail(
        to
      )} (${oldPlan} → ${newPlan})`,
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
    logWebhookInfo(
      `Sending subscription cancelled email to ${redactEmail(to)}`
    );

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
      `Failed to send subscription cancelled email to ${redactEmail(
        to
      )} (plan: ${plan})`,
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
 * Send contact form notification to admin
 * Contains the user's message and contact details
 */
export async function sendContactFormEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending contact form notification for ${redactEmail(email)}`);

    const emailHtml = await render(
      ContactFormEmail({
        name,
        email,
        subject,
        message,
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: "sebastiansole@handicappin.com",
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: emailHtml,
    });

    logWebhookSuccess(
      `Contact form notification sent successfully for ${redactEmail(email)}`,
      {
        messageId: result.data?.id,
        subject,
      }
    );

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logWebhookError(
      `Failed to send contact form notification for ${redactEmail(email)}`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send confirmation email to user after contact form submission
 */
export async function sendContactConfirmationEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}): Promise<SendEmailResult> {
  try {
    logWebhookInfo(`Sending contact confirmation to ${redactEmail(to)}`);

    const emailHtml = await render(
      ContactConfirmationEmail({
        name,
        supportEmail: "sebastiansole@handicappin.com",
      })
    );

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "We received your message - Handicappin'",
      html: emailHtml,
    });

    logWebhookSuccess(
      `Contact confirmation sent successfully to ${redactEmail(to)}`,
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
      `Failed to send contact confirmation to ${redactEmail(to)}`,
      error
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

