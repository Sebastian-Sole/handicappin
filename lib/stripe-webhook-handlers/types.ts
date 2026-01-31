import Stripe from "stripe";

export type WebhookContext = {
  event: Stripe.Event;
  eventId: string;
};

export type WebhookResult = {
  success: boolean;
  message?: string;
};

export type WebhookHandler = (ctx: WebhookContext) => Promise<WebhookResult>;
