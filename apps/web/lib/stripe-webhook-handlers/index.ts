import type { WebhookHandler } from "./types";
import { handleCustomerCreated } from "./customer-handlers";
import { handleCheckoutCompleted } from "./checkout-handlers";
import {
  handleSubscriptionChange,
  handleSubscriptionDeleted,
} from "./subscription-handlers";
import { handleInvoicePaymentFailed } from "./invoice-handlers";
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
} from "./payment-intent-handlers";
import { handleDisputeCreated } from "./dispute-handlers";
import { handleChargeRefunded } from "./refund-handlers";

export const webhookHandlers: Record<string, WebhookHandler> = {
  "customer.created": handleCustomerCreated,
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.created": handleSubscriptionChange,
  "customer.subscription.updated": handleSubscriptionChange,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.payment_failed": handlePaymentIntentFailed,
  "charge.dispute.created": handleDisputeCreated,
  "charge.refunded": handleChargeRefunded,
};

export * from "./types";
