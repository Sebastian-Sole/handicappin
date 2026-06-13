/**
 * Trust-boundary schema for RevenueCat webhook payloads.
 *
 * Shape source: RevenueCat's official webhook docs
 * (https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields,
 * read 2026-06-12): `{ api_version, event }` with a flat event object whose
 * optional fields vary by `type`. Loose-parsed — RevenueCat adds fields and
 * event types over time and an unknown extra must never bounce the webhook.
 */
import { z } from "zod";

/**
 * Event types that carry an entitlement claim we project into the profile
 * (decision ledger D-status-mapping).
 */
export const RC_ENTITLEMENT_EVENT_TYPES = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "UNCANCELLATION",
  "BILLING_ISSUE",
  "EXPIRATION",
  "NON_RENEWING_PURCHASE",
] as const;

export type RcEntitlementEventType =
  (typeof RC_ENTITLEMENT_EVENT_TYPES)[number];

export const rcEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    event_timestamp_ms: z.number().int().positive(),
    app_user_id: z.string().min(1).optional(),
    original_app_user_id: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    product_id: z.string().optional(),
    new_product_id: z.string().nullable().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    period_type: z.string().optional(),
    purchased_at_ms: z.number().int().nullable().optional(),
    expiration_at_ms: z.number().int().nullable().optional(),
    store: z.string().optional(),
    environment: z.string().optional(),
    cancel_reason: z.string().nullable().optional(),
    expiration_reason: z.string().nullable().optional(),
    transferred_from: z.array(z.string()).nullable().optional(),
    transferred_to: z.array(z.string()).nullable().optional(),
  })
  .loose();

export type RcEvent = z.infer<typeof rcEventSchema>;

export const rcWebhookPayloadSchema = z
  .object({
    api_version: z.string().optional(),
    event: rcEventSchema,
  })
  .loose();

export type RcWebhookPayload = z.infer<typeof rcWebhookPayloadSchema>;
