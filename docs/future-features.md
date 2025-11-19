# Future Expansions - Post-MVP Enhancements

This document tracks potential features and improvements to implement **after** the MVP is production-ready and stable.

## 🎯 MVP Completion Criteria

Before implementing any expansions, ensure:
- [ ] Stripe payments working reliably in production
- [ ] PII redaction implemented (Tickets #0035, #0036, #0042)
- [ ] No critical security issues
- [ ] Basic monitoring in place (Sentry)
- [ ] Webhooks handling all payment events correctly
- [ ] At least 100+ paying users with stable revenue

---

## 📧 User Communication & Experience

### Email Notification System
- [ ] **Payment Success Emails** - Confirmation email after successful checkout
  - Why: Users expect receipt confirmation, reduces "did my payment work?" support tickets
  - Effort: Medium (2-3 days with Resend integration)
  - Priority: High (implement when support tickets increase)

- [ ] **Payment Failure Alerts** - Email users when payment fails with retry instructions
  - Why: Proactive recovery increases payment success rate
  - Effort: Medium (2-3 days)
  - Priority: High (implement when payment failures > 5% of transactions)

- [ ] **Subscription Change Notifications** - Email on upgrade/downgrade/cancellation
  - Why: Transparency and audit trail for users
  - Effort: Low (1 day)
  - Priority: Medium

### In-App Notifications
- [ ] **Notification Center** - Bell icon with recent events
  - Why: Users can see payment status, subscription changes without email
  - Effort: Medium (3-4 days for full implementation)
  - Priority: Medium (defer until user base > 500)

- [ ] **Toast Notifications** - Success/error toasts on checkout redirect
  - Why: Immediate feedback on actions
  - Effort: Low (1 day)
  - Priority: Low (nice-to-have)

---

## 💳 Payment & Billing Enhancements

### Payment Status Dashboard
- [ ] **Invoice History** - List all past invoices with download PDF links
  - Why: Self-service for receipts, reduces support burden
  - Effort: Medium (2-3 days)
  - Priority: Medium (implement when users frequently request invoices)

- [ ] **Upcoming Charges Preview** - Show next billing amount and date
  - Why: Transparency, reduces surprise charges
  - Effort: Low (1 day)
  - Priority: Low

- [ ] **Manual Payment Retry Button** - User can retry failed payment themselves
  - Why: Self-service recovery, increases payment recovery rate
  - Effort: Low (1 day)
  - Priority: High (implement when payment failures increase)

- [ ] **Update Payment Method Flow** - Stripe Checkout setup mode for card updates
  - Why: Users can update expiring cards without contacting support
  - Effort: Medium (1-2 days)
  - Priority: Medium

### Advanced Billing Features
- [ ] **Usage-Based Billing** - Track and charge based on feature usage
  - Why: More flexible pricing models
  - Effort: High (1-2 weeks)
  - Priority: Low (only if business model requires it)

- [ ] **Proration Handling** - Mid-cycle upgrades/downgrades with prorated charges
  - Why: Stripe handles this, but need UI/UX to explain it
  - Effort: Medium (2-3 days)
  - Priority: Low (Stripe already does this automatically)

---

## 🔄 Operational Improvements

### Reconciliation Scalability
- [ ] **Pagination & Batching** - Process users in batches of 100 instead of all at once
  - Why: Prevents memory/timeout issues at scale (1,000+ users)
  - Effort: High (4-5 days)
  - Priority: Medium (implement when reconciliation takes > 30 seconds)

- [ ] **Resumable Reconciliation** - Can resume failed runs from last checkpoint
  - Why: Don't restart from beginning if job fails mid-run
  - Effort: Medium (2-3 days)
  - Priority: Low (only needed at scale)

- [ ] **Reconciliation Dashboard** - Admin UI to view drift issues, trigger manual runs
  - Why: Better visibility and control for operators
  - Effort: Medium (3-4 days)
  - Priority: Low (current cron job + logs are sufficient)

### Error Recovery & Resilience
- [ ] **Automatic Retry with Exponential Backoff** - Retry transient database errors
  - Why: Reduces webhook failures from temporary issues
  - Effort: Low (1 day for retry wrapper)
  - Priority: Medium (implement if seeing transient errors)

- [ ] **User-Friendly Error Messages** - Map Stripe error codes to plain English
  - Why: Better UX when payments fail
  - Effort: Low (1 day)
  - Priority: Low (Stripe messages are already decent)

- [ ] **Failed Payment Recovery Flow** - Automated email sequence for dunning
  - Why: Increases payment recovery rate
  - Effort: High (1 week with email sequences)
  - Priority: Low (Stripe Smart Retries already handles this)

---

## 🔒 Security & Compliance

### Granular Rate Limiting
- [ ] **Per-Route Rate Limits** - Different limits for auth (5/15min), payment (10/hour), API (60/min)
  - Why: Prevent brute force, credential stuffing, payment spam
  - Effort: Medium (2-3 days)
  - Priority: Medium (implement when seeing abuse patterns)

- [ ] **User-Based Rate Limiting** - Rate limit by user ID (not just IP)
  - Why: VPN/proxy bypass prevention
  - Effort: Low (1 day)
  - Priority: Low

### Audit Logging
- [ ] **Immutable Audit Trail** - Log all sensitive operations (logins, payments, changes)
  - Why: Compliance (SOC 2, GDPR), security investigations
  - Effort: High (4-5 days with database schema + integration)
  - Priority: Low (only needed for compliance requirements)

- [ ] **Admin Audit Log Viewer** - UI to query and view audit logs
  - Why: Easier investigations
  - Effort: Medium (2-3 days)
  - Priority: Low

### Fraud Detection
- [ ] **Failed Payment Spam Detection** - Alert on 3+ failed payments in 1 hour
  - Why: Fraud indicator, stolen card testing
  - Effort: Medium (2-3 days)
  - Priority: Low (Stripe Radar handles most fraud)

- [ ] **New Account High-Value Alerts** - Flag $100+ purchases from accounts < 7 days old
  - Why: Fraud prevention
  - Effort: Low (1 day)
  - Priority: Low (implement if seeing fraud)

- [ ] **Subscription Churning Detection** - Alert on 3+ subscription changes in 24 hours
  - Why: Abuse/testing detection
  - Effort: Low (1 day)
  - Priority: Low

### Brute Force Protection
- [ ] **Account Lockout** - Lock account after 5 failed login attempts for 15 minutes
  - Why: Prevent credential stuffing
  - Effort: Low (1 day)
  - Priority: Medium (implement before public launch)

- [ ] **Password Reset Rate Limiting** - Strict limits on reset requests
  - Why: Prevent password reset spam
  - Effort: Low (1 day)
  - Priority: Low

---

## 📊 Observability & Monitoring

### Structured Logging
- [ ] **JSON Logging in Production** - Structured logs for searchability
  - Why: Better debugging, log aggregation
  - Effort: Low (1 day for basic wrapper)
  - Priority: Medium (implement when debugging production issues is slow)

- [ ] **Correlation IDs** - Track requests across services
  - Why: Easier debugging of complex flows
  - Effort: Medium (2 days)
  - Priority: Low

- [ ] **Log Aggregation Platform** - Axiom, Datadog, or CloudWatch integration
  - Why: Centralized logs, better search, alerts
  - Effort: Medium (2-3 days)
  - Priority: Low (Vercel logs + Sentry are sufficient for now)

### Metrics & Dashboards
- [ ] **Key Metrics Tracking** - Checkout conversion, payment success rate, MRR, churn
  - Why: Business visibility
  - Effort: High (1 week for full dashboard)
  - Priority: Low (manual Stripe dashboard is fine for MVP)

- [ ] **Performance Monitoring** - API response times, database query performance
  - Why: Identify bottlenecks
  - Effort: Medium (3-4 days with Sentry Performance)
  - Priority: Low (implement if seeing performance issues)

- [ ] **Alerting Rules** - Slack/email alerts on critical events
  - Why: Proactive incident response
  - Effort: Low (1 day)
  - Priority: Low (Sentry alerts are sufficient)

---

## 🧪 Testing Infrastructure

### Unit Tests
- [ ] **Core Logic Tests** - Test redaction, validation, helpers (80%+ coverage)
  - Why: Safe refactoring, catch regressions
  - Effort: High (1 week for comprehensive coverage)
  - Priority: Medium (start with critical paths only)

- [ ] **Webhook Handler Tests** - Test all Stripe event types
  - Why: Webhook logic is complex and critical
  - Effort: High (3-4 days)
  - Priority: High (implement before major refactors)

### Integration Tests
- [ ] **Database Operation Tests** - Test full CRUD flows with test DB
  - Why: Catch SQL/schema issues
  - Effort: Medium (3-4 days)
  - Priority: Low

- [ ] **Stripe API Tests** - Test Stripe integration in test mode
  - Why: Verify API usage is correct
  - Effort: Medium (2-3 days)
  - Priority: Low

### End-to-End Tests
- [ ] **Checkout Flow E2E** - Full user journey from pricing page to dashboard
  - Why: Catch UI/UX regressions
  - Effort: High (1 week with Playwright setup)
  - Priority: Low (manual testing sufficient for MVP)

- [ ] **CI/CD Pipeline** - Automated tests on every PR
  - Why: Catch bugs before merge
  - Effort: Medium (2-3 days)
  - Priority: Medium (implement when team grows)

---

## 📈 Scaling & Performance

### Database Optimization
- [ ] **Connection Pooling** - Optimize Supabase connection usage
  - Why: Prevent connection exhaustion at scale
  - Effort: Low (1 day)
  - Priority: Low (implement when seeing connection issues)

- [ ] **Query Optimization** - Add indexes, optimize slow queries
  - Why: Faster page loads
  - Effort: Medium (ongoing)
  - Priority: Low (implement when queries are slow)

### Caching
- [ ] **Redis Caching** - Cache user profiles, plan data
  - Why: Reduce database load
  - Effort: Medium (3-4 days)
  - Priority: Low (only needed at high scale)

- [ ] **CDN for Static Assets** - Use Vercel Edge for static content
  - Why: Faster global delivery
  - Effort: Low (built-in to Vercel)
  - Priority: Low

---

## 🎨 User Experience Polish

### Better Error States
- [ ] **Empty States** - Friendly messages when no data exists
  - Why: Better UX for new users
  - Effort: Low (1 day)
  - Priority: Low

- [ ] **Loading Skeletons** - Skeleton screens instead of spinners
  - Why: Perceived performance improvement
  - Effort: Low (1-2 days)
  - Priority: Low

### Onboarding
- [ ] **Welcome Flow** - Guide new users through first payment
  - Why: Increase conversion
  - Effort: Medium (3-4 days)
  - Priority: Low (implement when conversion rate is measurable)

- [ ] **Feature Tour** - Highlight key features for new users
  - Why: User education
  - Effort: Medium (2-3 days)
  - Priority: Low

---

## ⚙️ Admin Tools

### Admin Dashboard
- [ ] **User Management** - View/edit user profiles, subscriptions
  - Why: Support operations
  - Effort: High (1 week)
  - Priority: Medium (implement when support load increases)

- [ ] **Manual Reconciliation Trigger** - Admin can trigger reconciliation runs
  - Why: On-demand drift checking
  - Effort: Low (1 day)
  - Priority: Low (cron job is sufficient)

- [ ] **Webhook Event Viewer** - See all webhook events, retry failed ones
  - Why: Debugging webhook issues
  - Effort: Medium (2-3 days)
  - Priority: Low (Stripe dashboard has this)

---

## 📋 Implementation Priority Guide

**Tier 1 - Implement When Needed (Monitor Metrics):**
- Payment failure alerts → Implement when failure rate > 5%
- Invoice history → Implement when users request it frequently
- Brute force protection → Implement before public launch
- Manual payment retry → Implement when failures increase
- Reconciliation pagination → Implement when runtime > 30s

**Tier 2 - Polish & UX (Post-Product-Market-Fit):**
- Email notifications
- In-app notifications
- Payment dashboard
- User-friendly error messages
- Loading states

**Tier 3 - Scale & Operations (When Team/Revenue Grows):**
- Audit logging (needed for SOC 2 compliance)
- Structured logging + log aggregation
- Metrics dashboards
- Admin tools
- Testing infrastructure

**Tier 4 - Advanced Features (Future Product Evolution):**
- Usage-based billing
- Fraud detection
- Advanced analytics
- Multi-currency support

---

## 🚀 Decision Framework: "Should I Build This Now?"

Ask these questions:

1. **Is it blocking revenue?** → Build immediately
2. **Is it a security issue?** → Build immediately
3. **Are users actively asking for it?** → Build soon
4. **Is it causing support burden?** → Build when support load is high
5. **Will it help reach next growth milestone?** → Build if clear ROI
6. **Is it "nice to have"?** → Defer until tiers 1-2 complete

**Example:**
- "Payment failure emails" - Users asking? No. Support burden? Maybe later. → **Defer**
- "Manual payment retry" - Blocking revenue? If failures are high, yes. → **Monitor metrics, build when needed**
- "Testing infrastructure" - Blocking? Not yet. → **Start with webhook tests only when refactoring**

---

## 📝 Notes

**MVP Philosophy:**
> "Build the minimum viable payment system that works reliably. Iterate based on actual user feedback and metrics, not imagined needs."

**Stripe Already Handles:**
- Smart payment retries (4 attempts over 3 weeks)
- Fraud detection (Stripe Radar)
- Dunning emails (can be enabled in Stripe dashboard)
- Invoice PDFs (Stripe Checkout provides these)

**Use Stripe's Built-In Features First:**
Before building custom solutions, check if Stripe already provides it. Examples:
- Payment retry logic → Stripe Smart Retries
- Fraud detection → Stripe Radar
- Customer portal → Stripe Customer Portal (can enable with 1 API call)
- Invoice management → Stripe Billing Portal

**When to Build vs. Buy/Use SaaS:**
- Notifications → Use Resend/SendGrid (don't build email infrastructure)
- Metrics → Use Stripe Dashboard + basic spreadsheet (don't build analytics platform)
- Admin tools → Use Stripe Dashboard for first 6 months (don't build admin UI yet)

---

## 🏷️ Meta

- Created: 2025-01-15
- Last Updated: 2025-01-15
- Review Frequency: Quarterly (re-prioritize based on metrics)
- Owner: Engineering team
