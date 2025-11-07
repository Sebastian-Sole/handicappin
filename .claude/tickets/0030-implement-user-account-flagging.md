# 0030 - Implement User Account Flagging for Review

## 🎯 **Description**

Add account flagging system to mark users for manual review when suspicious activity occurs (disputes, refund abuse, payment patterns).

## 📋 **User Story**

As an admin, I want user accounts automatically flagged when suspicious activity occurs so that I can review patterns, identify fraud, and take appropriate action.

## 🔧 **Technical Context**

The dispute handler at `app/api/stripe/webhook/route.ts:933` has a TODO for flagging user accounts when disputes are filed. Currently, suspicious events are logged but not tracked in a reviewable format.

Account flagging enables:
- Fraud pattern detection
- Manual review workflow
- Historical tracking of problematic accounts
- Proactive risk management

## ✅ **Acceptance Criteria**

- [ ] Database schema updated to track account flags
- [ ] Users flagged when dispute is created
- [ ] Flag includes reason, severity, and timestamp
- [ ] Multiple flags can exist per user
- [ ] Flags are queryable for admin review
- [ ] Flagging doesn't impact user experience (silent)

## 🚨 **Technical Requirements**

### **Implementation Details**

Add table or columns to track flags:
```
account_flags table:
- id
- user_id
- flag_type (dispute_filed, multiple_refunds, payment_pattern_suspicious)
- severity (low, medium, high)
- reason (text description)
- metadata (JSON for additional context)
- created_at
- resolved_at (nullable)
- resolved_by (nullable)
- resolution_notes (nullable)
```

Or add to profile table:
```
- account_status (active, flagged, suspended)
- flag_reason
- flagged_at
```

### **Dependencies**

- Database migration
- Update to profile or new account_flags table
- Integration with handleDisputeCreated

### **Integration Points**

- `handleDisputeCreated` (line 845-946)
- Potentially other handlers (multiple refunds, etc.)
- Future admin dashboard for flag review

## 🔍 **Implementation Notes**

- Flags should be additive (don't replace existing flags)
- Consider automatic flag expiration for low-severity items
- Track who resolved flags for accountability
- Allow notes/context when resolving flags
- Consider flag severity escalation (e.g., 3 low = 1 medium)

## 📊 **Definition of Done**

- [ ] Database schema created/updated
- [ ] Migration tested
- [ ] Flagging implemented in dispute handler
- [ ] Query/admin view capability exists
- [ ] Documentation for flag types and process

## 🧪 **Testing Requirements**

- [ ] Test flag creation on dispute event
- [ ] Verify multiple flags per user work correctly
- [ ] Test flag queries and filtering
- [ ] Ensure flagging doesn't affect user experience
- [ ] Test database migration rollback

## 🚫 **Out of Scope**

- Admin UI for reviewing flags (separate ticket)
- Automated flag resolution
- Flag-based access restrictions
- Pattern detection algorithms
- Email notifications for flags

## 📝 **Notes**

Start simple with basic flagging on disputes. Can expand to include:
- Multiple refunds in short period
- Suspicious payment patterns
- Customer support complaints
- Terms of service violations

## 🏷️ **Labels**

- `priority: medium`
- `type: feature`
- `component: billing`
- `component: security`
- `database-change`
- `admin-facing`
