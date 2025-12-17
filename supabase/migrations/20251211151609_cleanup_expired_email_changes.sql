-- ============================================
-- CLEANUP EXPIRED PENDING EMAIL CHANGES
-- Runs daily to delete expired records
-- ============================================

SELECT cron.schedule(
  'cleanup-expired-email-changes',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  DELETE FROM public.pending_email_changes
  WHERE expires_at < NOW();
  $$
);
