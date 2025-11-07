# 0031 - Cleanup Job for Old Failed Purchases

## 🎯 **Description**

Implement scheduled cleanup job to remove or archive old failed purchase records from the `pending_lifetime_purchases` table.

## 📋 **User Story**

As a developer, I want old failed purchase records automatically cleaned up so that the database stays lean and queries remain performant.

## 🔧 **Technical Context**

The `pending_lifetime_purchases` table tracks lifetime purchase attempts. Failed purchases (status='failed') accumulate indefinitely. Line 634 in `app/api/stripe/webhook/route.ts` has a TODO for implementing cleanup.

After a certain period (30-90 days), failed purchases serve no operational purpose and should be removed to prevent table bloat.

## ✅ **Acceptance Criteria**

- [ ] Scheduled job runs periodically (daily or weekly)
- [ ] Removes failed purchases older than configurable threshold (default 90 days)
- [ ] Optionally archives to separate table before deletion
- [ ] Logs count of records processed
- [ ] Doesn't delete pending or paid records
- [ ] Job failure is logged and alerted

## 🚨 **Technical Requirements**

### **Implementation Details**

Options for scheduling:
- Vercel cron job (if using Vercel)
- GitHub Actions scheduled workflow
- Database-level scheduled job (PostgreSQL)
- Separate background worker

Delete records where:
- `status = 'failed'`
- `updated_at < NOW() - INTERVAL '90 days'`

Consider archiving before deletion:
```sql
INSERT INTO pending_lifetime_purchases_archive
SELECT * FROM pending_lifetime_purchases
WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '90 days';

DELETE FROM pending_lifetime_purchases
WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '90 days';
```

### **Dependencies**

- Cron job infrastructure
- Optional: Archive table schema
- Environment variable for retention period
- Monitoring/logging for job execution

### **Integration Points**

- `pending_lifetime_purchases` table
- Logging system
- Monitoring/alerting system (if job fails)

## 🔍 **Implementation Notes**

- Start conservative with 90-day retention
- Consider soft delete (add deleted_at column) instead of hard delete
- Run during low-traffic hours if possible
- Add database index on (status, updated_at) for query performance
- Consider retention policy for paid/completed records too
- Log execution time and record count for monitoring

## 📊 **Definition of Done**

- [ ] Cleanup job implemented and scheduled
- [ ] Retention period configurable
- [ ] Job logs execution and results
- [ ] Documentation for job configuration
- [ ] Monitoring/alerting for job failures

## 🧪 **Testing Requirements**

- [ ] Test job in development environment
- [ ] Verify correct records are deleted
- [ ] Confirm pending/paid records are preserved
- [ ] Test with large dataset for performance
- [ ] Verify job can be manually triggered

## 🚫 **Out of Scope**

- Analytics on failed purchases
- UI for manual cleanup
- Cleanup of other tables
- Complex archival strategies
- Data export functionality

## 📝 **Notes**

This is lower priority than user-facing features. Can be implemented after critical billing features are stable.

Consider using Vercel cron if on Vercel platform - simplest option. Otherwise, GitHub Actions scheduled workflow works well.

## 🏷️ **Labels**

- `priority: low`
- `type: maintenance`
- `component: billing`
- `component: database`
- `background-job`
