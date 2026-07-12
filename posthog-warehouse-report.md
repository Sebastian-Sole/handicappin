# PostHog Data Warehouse — Source Setup Report

**Date:** 2026-07-12  
**Project:** handicappin  
**PostHog Project ID:** 101298  
**PostHog Host:** https://eu.posthog.com

---

## Summary

No sources were automatically created in this run. The wizard detected 6 data sources across 5 unique kinds. The Supabase database credentials were declined during the interactive prompt, and a follow-on `wizard_ask` call became unavailable (pending-state error from the cancellation), so all remaining sources fell back to the deep-link path.

All sources can be connected manually using the URLs below — PostHog's credential fields are pre-selected by the `kind` parameter.

---

## Sources to Connect via Browser

Open each URL while logged into PostHog (eu.posthog.com) and fill in the credentials described.

### 1. Supabase Database (kind: Postgres)

> **Detected because:** `postgres` + `@supabase/supabase-js` are in package.json. Supabase is a hosted Postgres — connect it as a Postgres source using the Session pooler.

**Setup URL:**  
https://eu.posthog.com/project/101298/data-warehouse/new-source?kind=Postgres

**Required credentials (Supabase → Settings → Database → Connection pooling):**

| Field | Value |
|---|---|
| Host | `aws-0-<region>.pooler.supabase.com` (Session pooler host) |
| Port | `6543` (NOT 5432) |
| Database | `postgres` |
| User | `postgres.<your-project-ref>` |
| Password | Your **database** password (not the anon/service_role JWT) |
| Schema | `public` (default) |

> The `DATABASE_URL` env var is present but likely uses the direct IPv6 host — use the Session pooler host instead.

---

### 2. Stripe (kind: Stripe)

**Setup URL:**  
https://eu.posthog.com/project/101298/data-warehouse/new-source?kind=Stripe

**Required credentials:**

| Field | Value |
|---|---|
| API key | A **restricted** key starting with `rk_live_…` (NOT `sk_live_…`) |
| Account ID | Found at https://dashboard.stripe.com/settings/account |

> Your `STRIPE_SECRET_KEY` (sk_live_…) cannot be used here. Create a new restricted key at:  
> https://dashboard.stripe.com/apikeys/create?name=PostHog with read permissions for charges, customers, invoices, subscriptions, products, payouts, balance transactions, and payment methods.

**Tables synced:** balance_transaction, charge, customer, dispute, invoice, payout, plan, product, credit_note, subscription, transfer, connected_account, payment_method

---

### 3. Resend (kind: Resend)

**Setup URL:**  
https://eu.posthog.com/project/101298/data-warehouse/new-source?kind=Resend

**Required credentials:**

| Field | Value |
|---|---|
| API key | A **full-access** Resend key (`re_…`) |

> Your existing `RESEND_API_KEY` may be send-only (restricted). Create a new key with **Full access** at https://resend.com/api-keys so PostHog can read Audiences, Broadcasts, Contacts, Domains, and Emails.

---

### 4. Sentry (kind: Sentry)

**Setup URL:**  
https://eu.posthog.com/project/101298/data-warehouse/new-source?kind=Sentry

**Required credentials:**

| Field | Value |
|---|---|
| Auth token | An **internal integration** token (NOT a DSN or personal token) |
| Organization slug | Your Sentry org slug (visible in the Sentry URL) |
| API base URL | `https://sentry.io` (default) |

> Create an internal integration at Sentry → Settings → Developer Settings → New Internal Integration. Required scopes: `alerts:read`, `event:read`, `member:read`, `org:read`, `project:read`, `team:read`.

**Tables synced:** organization, project, issue, monitor

---

### 5. RevenueCat (kind: RevenueCat)

**Setup URL:**  
https://eu.posthog.com/project/101298/data-warehouse/new-source?kind=RevenueCat

**Required credentials:**

| Field | Value |
|---|---|
| Secret API key | A **v2** secret key starting with `sk_…` |
| Project ID | Starts with `proj…`, found in the RevenueCat dashboard URL |

> Generate a v2 secret key with read access to customers, products, entitlements, offerings, apps, and integrations (read/write for automatic webhook setup) at:  
> https://app.revenuecat.com/projects/_/api-keys

**Tables synced:** customers, products, entitlements, offerings, apps; realtime subscription/purchase events via webhook

---

## Changes Made

- No source-code files were modified.
- No `.env` files were modified.
- This report file (`posthog-warehouse-report.md`) was created.

---

## Manual Steps (in order)

1. **Supabase (Postgres):** Open the setup URL above. Use the Session pooler credentials from Supabase → Settings → Database → Connection pooling.
2. **Stripe:** Create a restricted key (`rk_live_…`) in the Stripe dashboard, then open the setup URL above.
3. **Resend:** Create a full-access key in the Resend dashboard, then open the setup URL above.
4. **Sentry:** Create an internal integration token in Sentry Developer Settings with the required scopes, then open the setup URL above.
5. **RevenueCat:** Generate a v2 secret key in the RevenueCat dashboard, then open the setup URL above.

After connecting each source, PostHog will begin syncing data. Initial syncs may take several minutes to hours depending on data volume. You can monitor sync status in PostHog → Data Warehouse → Sources.
