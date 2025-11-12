<!-- # 0001 - Stripe Subscription System (MVP)

## 🎯 **Description**

Implement a barebones subscription system using Stripe payment links with a freemium model. The system includes tiered subscriptions (Base, Premium, Unlimited, and Lifetime) with round limit tracking and enforcement.

## 📋 **User Story**

**Primary User Stories:**

1. As a casual golfer, I want to track up to 25 rounds for free so that I can try the platform without commitment
2. As a regular golfer, I want to upgrade to Premium for unlimited rounds so that I can continue tracking my golf game
3. As a serious golfer, I want to upgrade to Unlimited for all premium features so that I can improve my game with detailed insights
4. As a committed golfer, I want to purchase a lifetime subscription so that I never have to pay again
5. As an early adopter (first 100 users), I want free unlimited rounds forever so that I'm rewarded for being an early supporter

## 🔧 **Technical Context**

### Business Model Rationale

**Freemium Strategy:**

- Free tier (25 rounds) drives user acquisition and creates high user count for potential sponsorships
- By the time users hit 25 rounds, they have accumulated valuable data and formed habits (switching cost)
- Lock-in effect: Users with historical data are more likely to convert than abandon

**Pricing Psychology (Decoy Pricing):**

- Premium at $19/year acts as a pricing anchor/decoy
- Makes Unlimited at $29/year feel like obvious value ($10 more for 3x features)
- Expected conversion: 70-80% of paying customers choose Unlimited over Premium
- Round packs are priced to make subscriptions feel like better value

**Revenue Streams:**

1. Recurring subscriptions (primary revenue)
2. Lifetime purchases (upfront cash, whale capture)

### Current State

- No subscription system exists
- No payment processing implemented
- No round limits or usage tracking
- No referral or promotional systems
- Profile table has basic user data but no subscription fields

## ✅ **Acceptance Criteria**

### Core Subscription System

- [ ] Users can sign up for free and get 25 rounds total
- [ ] Users can upgrade to Premium ($19/year) for unlimited rounds (basic features only)
- [ ] Users can upgrade to Unlimited ($29/year) for all premium features
- [ ] Users can purchase Lifetime ($149 one-time) for everything forever
- [ ] First 100 users automatically get Premium tier for free forever (unlimited rounds, no premium features)
- [ ] Subscription status syncs automatically via Stripe webhooks
- [ ] Users are prevented from adding rounds when they exceed their limit (base tier only)
- [ ] Landing page displays correct pricing and links to Stripe payment pages

### Round Tracking & Limits

- [ ] System tracks rounds used for base tier users (25 round limit)
- [ ] Base tier users see remaining rounds in their dashboard
- [ ] Premium, Unlimited, and early adopter users have unlimited rounds (no tracking needed)
- [ ] When base tier user attempts to add a round beyond 25, they see upgrade prompt

### Access Control & Feature Gates

- [ ] Base tier: 25 rounds total, basic handicap calculation, score history, round logging
- [ ] Premium tier: Unlimited rounds, basic features (same as Base but no limit)
- [ ] Unlimited tier: Unlimited rounds + round insights, analytics, advanced calculators, priority support
- [ ] Early adopters (first 100 users): Free Premium tier forever (unlimited rounds, basic features)
- [ ] Feature access checks implemented before rendering premium features
- [ ] Upgrade prompts shown contextually when users try to access premium features or reach round limit

## 🚨 **Technical Requirements**

### Database Schema Changes

**Profile Table Updates (via Drizzle ORM):**

Add the following fields to the profile table:

- `subscription_tier` - TEXT, default 'base', enum: 'base' | 'premium' | 'unlimited'
- `subscription_status` - TEXT, default 'active', enum: 'active' | 'cancelled' | 'expired' | 'trialing'
- `subscription_type` - TEXT, default 'recurring', enum: 'recurring' | 'lifetime' | 'promo'
- `stripe_customer_id` - TEXT, nullable
- `stripe_subscription_id` - TEXT, nullable
- `subscription_started_at` - TIMESTAMP, nullable
- `subscription_expires_at` - TIMESTAMP, nullable
- `is_early_adopter` - BOOLEAN, default false
- `rounds_used` - INTEGER, default 0 (only tracked for base tier)
- `updated_at` - TIMESTAMP, default CURRENT_TIMESTAMP

**Indexes to Create:**

- Index on `stripe_customer_id` for webhook lookups
- Index on `subscription_tier` for analytics queries
- Index on `is_early_adopter` for filtering early adopters

### Stripe Integration

**Environment Variables:**

```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_UNLIMITED_PRICE_ID=price_...
STRIPE_UNLIMITED_LIFETIME_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PREMIUM_LINK=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_UNLIMITED_LINK=https://buy.stripe.com/...
NEXT_PUBLIC_STRIPE_UNLIMITED_LIFETIME_LINK=https://buy.stripe.com/...
```

**Stripe Products to Create:**

1. Premium Plan: $19/year recurring
2. Unlimited Plan: $29/year recurring
3. Unlimited Lifetime: $149 one-time

**Webhook Events to Handle:**

- `checkout.session.completed` - New subscription or one-time purchase
- `customer.subscription.updated` - Subscription changes
- `customer.subscription.deleted` - Subscription cancellation
- `invoice.payment_succeeded` - Successful renewal
- `invoice.payment_failed` - Failed payment

### Key Files to Create/Modify

**New Files to Create:**

- Stripe client library with plan definitions and helpers
- Stripe webhook handler API route for processing subscription events
- Subscription access control utilities for checking tier and feature access
- Round limit checking logic for base tier users
- Upgrade prompt component for when users hit limits or try premium features
- Pricing comparison component for landing page
- Database migration for subscription fields

**Existing Files to Modify:**

- Profile schema in Drizzle ORM to add subscription fields
- Environment configuration to add Stripe keys and settings
- Landing page to show pricing and link to Stripe payment pages
- Round creation logic to check limits before allowing new rounds
- Dashboard to display subscription status and remaining rounds (base tier only)

### Implementation Sequence

**Phase 1: Core Infrastructure (Foundation)**

1. Create Drizzle migration for subscription fields on profile table
2. Update profile schema with subscription-related fields
3. Set up Stripe client library and configuration
4. Add Stripe environment variables

**Phase 2: Subscription Management (Payment Flow)**

1. Create Stripe products and payment links in Stripe dashboard
2. Implement webhook handler to process Stripe events
3. Update landing page with pricing tiers and Stripe payment links
4. Test subscription flows (upgrade, cancel, renew)

**Phase 3: Access Control (Feature Gates)**

1. Implement round limit checking for base tier users
2. Create utility functions for checking tier and feature access
3. Add upgrade prompts when users hit round limit
4. Prevent round creation when base tier exceeds 25 rounds
5. Update dashboard to show subscription status and rounds remaining

**Phase 4: Early Adopter Program**

1. Identify first 100 users by creation date
2. Mark them with is_early_adopter flag and Premium tier
3. Set subscription_type to 'promo' for these users
4. Ensure they have unlimited rounds with no premium features
5. Display early adopter status in their profile/dashboard

## 🔍 **Implementation Notes**

### Round Limit Logic

**Base Tier Users:**

- Have a fixed limit of 25 rounds
- Track `rounds_used` field
- When `rounds_used >= 25`, block new round creation
- Show upgrade prompt when limit is reached

**All Other Tiers (Premium, Unlimited, Early Adopters):**

- Unlimited rounds
- No tracking of `rounds_used` (can keep at 0 or not increment)
- No round limit checks needed

**Access Control Logic:**

- Check user's `subscription_tier`
- If tier is 'base', check if `rounds_used < 25`
- If tier is anything else ('premium', 'unlimited'), allow unlimited rounds
- Early adopters are set to 'premium' tier with 'promo' type

### Pricing Strategy Justification

**Why these specific prices?**

1. **Base (Free, 25 rounds):**

   - Generous enough for 1-2 years of casual use
   - Builds habit and data lock-in
   - High user count attracts sponsorships
   - Most won't convert but act as marketing

2. **Premium ($19/year - DECOY):**

   - Only $10 less than Unlimited
   - Unlimited rounds but no premium features
   - Makes Unlimited look like obvious choice
   - Expected: Only 14% of paid users choose this

3. **Unlimited ($29/year - PRIMARY):**

   - Under $2.50/month (impulse purchase)
   - All features = clear value proposition
   - Expected: 86% of paid users choose this
   - Main revenue driver

4. **Lifetime ($149 - WHALE CAPTURE):**

   - 5.1x annual Unlimited price
   - Break-even at 5 years
   - Captures committed users
   - Generates upfront cash flow

### Conversion Psychology

**Free → Paid Journey:**

```
Day 1:     User signs up, gets 25 free rounds
Month 3:   User has 10 rounds logged, invested in platform
Month 8:   User at 20/25 rounds, sees "5 left!" warning
           Prompt: "Refer a friend for +10 free rounds"
Month 10:  User hits 25 rounds, blocking modal:
           "Your free rounds are used! Options:
           🎁 Refer 2 friends (20 free rounds)
           💰 Buy 25 rounds ($4.99)
           ⭐ Upgrade to Premium ($19/year, unlimited)
           🚀 Upgrade to Unlimited ($29/year, unlimited + insights)"

Decision:  User has 25 rounds of data stored
           Switching cost is high
           70% convert to paid
           → 86% choose Unlimited ($29)
           → 14% choose Premium ($19)
```

### Security Considerations

**Webhook Security:**

- Verify Stripe webhook signatures to ensure events are legitimate
- Handle webhook events idempotently (same event processed multiple times should be safe)
- Log all webhook events for debugging and audit

**Payment Security:**

- Never store credit card information (Stripe handles all payment data)
- Use HTTPS for all payment link redirects
- Validate subscription status before granting premium features

### Feature Differentiation

| Feature               | Base     | Premium  | Unlimited   |
| --------------------- | -------- | -------- | ----------- |
| Round Logging         | ✅       | ✅       | ✅          |
| Handicap Calculation  | ✅ Basic | ✅ Basic | ✅ Advanced |
| Score History         | ✅       | ✅       | ✅          |
| Round Insights        | ❌       | ❌       | ✅          |
| Performance Analytics | ❌       | ❌       | ✅          |
| Trend Charts          | ❌       | ❌       | ✅          |
| Advanced Calculators  | ❌       | ❌       | ✅          |
| Priority Support      | ❌       | ❌       | ✅          |
| Early Feature Access  | ❌       | ❌       | ✅          |

## 📊 **Definition of Done**

- [ ] Database migration completed successfully in all environments
- [ ] Stripe products and payment links created and tested
- [ ] Webhook endpoint receiving and processing events correctly
- [ ] Users can successfully upgrade via payment links
- [ ] Subscription status updates automatically from Stripe
- [ ] Round limits enforced correctly for all tiers
- [ ] Referral system generates codes and awards rounds
- [ ] Round pack purchases work and rounds are credited
- [ ] Admin panel functional for all management tasks
- [ ] First 100 users marked as early adopters
- [ ] Landing page displays correct pricing with working links
- [ ] All upgrade prompts and CTAs in place
- [ ] Documentation updated (implementation guide, schema docs)
- [ ] Test transactions completed in Stripe test mode
- [ ] Production webhook configured and verified
- [ ] Analytics tracking implemented for conversions
- [ ] Email notifications set up for subscription events
- [ ] Error handling and logging implemented throughout
- [ ] Security audit completed (webhook signatures, API keys, etc.)

## 🧪 **Testing Requirements**

### Manual Testing

**Subscription Flows:**

- [ ] Free user can sign up and gets 25 rounds
- [ ] User can upgrade to Premium via Stripe link
- [ ] User can upgrade to Unlimited via Stripe link
- [ ] User can purchase Lifetime subscription
- [ ] Webhook updates profile correctly after payment
- [ ] Cancelled subscription downgrades user properly
- [ ] Expired subscription blocks access appropriately
- [ ] First 100 users get Premium tier for free forever

**Round Management:**

- [ ] Round counter increments when base tier user adds round
- [ ] Base tier user blocked from adding rounds at 25 limit
- [ ] Premium/Unlimited/Early adopter users have unlimited rounds
- [ ] Rounds used counter only tracks for base tier

**Feature Access:**

- [ ] Base tier users cannot access premium features (insights, analytics, advanced calculators)
- [ ] Premium tier users can access unlimited rounds but not premium features
- [ ] Unlimited tier users can access all premium features
- [ ] Early adopters have Premium tier access (unlimited rounds, no premium features)
- [ ] Upgrade prompts shown when base users hit limit or try premium features

### Test Scenarios

**Scenario 1: Free to Unlimited Journey**

1. Sign up → Get 25 free rounds
2. Add 20 rounds
3. See "5 rounds remaining" warning
4. Add 5 more rounds → Hit limit
5. See upgrade modal
6. Click Unlimited upgrade → Redirected to Stripe
7. Complete payment (test card)
8. Redirected back to dashboard
9. Subscription status shows "Unlimited"
10. Can now add unlimited rounds
11. Premium features are unlocked

**Scenario 2: Early Adopter**

1. User signs up (user #47)
2. System marks as early adopter
3. Sets subscription_tier to 'premium'
4. Sets subscription_type to 'promo'
5. User has unlimited rounds
6. User does not have premium features (insights, analytics)
7. Dashboard shows "Early Adopter" badge

### Edge Cases to Test

- [ ] User cancels subscription mid-year (should keep access until expiration)
- [ ] User purchases Lifetime after paying for annual (handle in Stripe/webhook)
- [ ] User #101 signs up (should NOT be early adopter)
- [ ] Webhook fails to process (implement retry mechanism)
- [ ] User deletes account with active subscription (handle Stripe cancellation)
- [ ] Early adopter marked incorrectly (admin tool to fix)

### Automated Testing

**Unit Tests:**

- [ ] Round limit check returns correct values for each tier
- [ ] Feature access check returns correct permissions for each tier
- [ ] Early adopter detection works correctly (first 100 users)
- [ ] Webhook signature verification works

**Integration Tests:**

- [ ] Stripe webhook updates database correctly
- [ ] Round creation increments counter for base tier only
- [ ] Subscription upgrade changes tier correctly
- [ ] Early adopter users get correct permissions

## 🚫 **Out of Scope**

### Explicitly NOT Included in This Ticket:

- **Referral System:** No referral codes or viral growth features (future ticket)
- **Round Pack Purchases:** No microtransactions for additional rounds (future ticket)
- **Admin Promotional Tools:** No bulk campaigns or bonus round adjustments (future ticket)
- **Custom Checkout Flow:** Using Stripe Payment Links, not building custom checkout UI
- **Automated Email Marketing:** No drip campaigns or marketing automation
- **Gift Subscriptions:** Users cannot buy subscriptions for others
- **Team/Organization Accounts:** Individual users only
- **Discount Codes:** Not implementing custom promo system initially
- **Multi-Currency Support:** USD only for launch
- **Subscription Pausing:** Users must cancel/resubscribe
- **Pro-rated Upgrades:** Simple full-price upgrades only
- **Usage-Based Billing:** Fixed tiers only

### Future Enhancements (Separate Tickets):

- Referral system with bonus rounds
- Round pack microtransactions
- Admin promotional campaign tools
- Enhanced analytics dashboard
- Discount/promo code system
- Team accounts for golf clubs

## 📝 **Notes**

### Pricing Evolution Strategy

**Launch Phase (Months 1-6):**

- Base: 25 free rounds
- Premium: $19/year
- Unlimited: $29/year
- Lifetime: $99 (early bird special)

**Growth Phase (Months 7-18):**

- Base: 25 free rounds (maintain for user count)
- Premium: $19/year (keep as decoy)
- Unlimited: $29/year
- Lifetime: $149 (remove early bird discount)

**Mature Phase (18+ months):**

- Base: 20 free rounds (tighten funnel)
- Premium: $24/year
- Unlimited: $39/year
- Lifetime: $199
- Grandfather all existing subscribers at their original price

### Success Metrics to Track

**Acquisition Metrics:**

- Free signups per month
- User count milestone (targeting first 100 for early adopter status)

**Monetization Metrics:**

- Free to paid conversion rate
- Premium vs Unlimited selection rate (targeting ~14% / 86%)
- Average revenue per user (ARPU)
- Customer lifetime value (CLV)
- Lifetime subscription adoption rate

**Engagement Metrics:**

- Rounds logged per user
- Time to reach 25-round limit
- Round limit hit rate (% of base tier users who reach limit)
- Upgrade prompt click-through rate

### Risk Mitigation

**Technical Risks:**

- Stripe webhook failures → Implement retry logic and manual admin tools
- Database migration issues → Test thoroughly in staging first
- Payment processing errors → Clear error messages and support contact

**Business Risks:**

- Low conversion rates → A/B test upgrade prompts and messaging
- Decoy pricing doesn't work → Adjust Premium features/price
- Early adopters exceed 100 → Need clear cutoff mechanism

**User Experience Risks:**

- Confusing pricing → User testing and clear documentation
- Frustrated free users → Generous limits and good communication
- Subscription fatigue → Lifetime option provides alternative

### Dependencies

**External Services:**

- Stripe account (test and production)
- Stripe webhook endpoint (requires publicly accessible URL)
- Email service for receipts (Stripe handles automatically)

**Internal Systems:**

- Supabase database access
- tRPC API infrastructure
- Authentication system (existing)
- Drizzle ORM for schema management

### Related Documentation

- Implementation guide to be created during development
- Schema documentation to be created during development
- Pricing strategy documented in this ticket

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: subscriptions`
- `component: payments`
- `mvp`
- `revenue-critical`
- `requires-external-service`
- `database-migration`
- `user-facing`

---

**Estimated Effort:** 20-30 hours (1 sprint cycle)

**Complexity:** High (external service integration, multiple interconnected features)

**Business Impact:** Critical (primary monetization strategy)

**User Impact:** High (affects all user journeys and core value proposition) -->
