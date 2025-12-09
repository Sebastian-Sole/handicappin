#!/bin/bash

# Real-time Queue Monitoring Dashboard
# Shows queue status, cron job history, and provides quick actions

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

clear

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Queue-Based Handicap Calculation Dashboard             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Current Queue Status
echo "📊 CURRENT QUEUE STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DB_URL" -c "
SELECT
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM handicap_calculation_queue;
"

echo ""
echo "📋 QUEUE ENTRIES (Last 10)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DB_URL" -c "
SELECT
    id,
    LEFT(user_id::text, 8) || '...' as user,
    event_type,
    status,
    attempts,
    created_at,
    last_updated
FROM handicap_calculation_queue
ORDER BY created_at DESC
LIMIT 10;
"

echo ""
echo "⏰ CRON JOB STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DB_URL" -c "
SELECT
    jobname,
    schedule,
    active,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = j.jobid) as total_runs,
    (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = j.jobid AND status = 'succeeded') as successful_runs,
    (SELECT MAX(end_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run
FROM cron.job j
WHERE jobname = 'process-handicap-queue';
"

echo ""
echo "📜 RECENT EXECUTIONS (Last 5)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DB_URL" -c "
SELECT
    runid,
    status,
    return_message,
    start_time,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 as duration_ms
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-handicap-queue')
ORDER BY start_time DESC
LIMIT 5;
"

# Failed jobs detail
FAILED_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM handicap_calculation_queue WHERE status = 'failed';")
if [ "$FAILED_COUNT" -gt 0 ]; then
    echo ""
    echo "⚠️  FAILED JOBS DETAIL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    psql "$DB_URL" -c "
    SELECT
        id,
        LEFT(user_id::text, 8) || '...' as user,
        attempts,
        LEFT(error_message, 60) as error,
        last_updated
    FROM handicap_calculation_queue
    WHERE status = 'failed'
    ORDER BY last_updated DESC;
    "
fi

echo ""
echo "🔧 QUICK ACTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Trigger processor now:  curl -i http://127.0.0.1:54321/functions/v1/process-handicap-queue \\"
echo "                        --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' \\"
echo "                        --header 'Content-Type: application/json'"
echo ""
echo "Clear queue:            psql $DB_URL -c 'DELETE FROM handicap_calculation_queue;'"
echo "View function logs:     supabase functions logs process-handicap-queue --local"
echo "Watch queue real-time:  watch -n 2 './monitor-queue.sh'"
echo ""
