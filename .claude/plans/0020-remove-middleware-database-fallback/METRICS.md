# Session Verification Metrics

## Key Metrics to Monitor

### 1. JWT Claims Missing Rate
**Metric**: `jwt_claims_missing`
**Location**: Middleware (utils/supabase/middleware.ts)
**Expected**: <1% of authenticated requests
**Alert Threshold**: >5% over 1 hour

**What it means**:
- How often users hit middleware without JWT claims
- Should be rare if JWT hook is working
- Spike indicates JWT hook issues

### 2. Verification Success Rate
**Metric**: `session_verification_success`
**Location**: Verification page (app/auth/verify-session)
**Expected**: >95% of verification attempts
**Alert Threshold**: <90% over 1 hour

**What it means**:
- How often retry logic successfully recovers claims
- High success rate = JWT hook works, just needs a refresh
- Low success rate = deeper JWT hook issues

### 3. Verification Failure Rate
**Metric**: `session_verification_failed`
**Location**: Verification page (app/auth/verify-session)
**Expected**: <5% of verification attempts
**Alert Threshold**: >10% over 1 hour

**What it means**:
- Users who couldn't recover after 3 attempts
- These users are forced to re-login
- High rate indicates critical JWT hook issues

### 4. Verification Error Rate
**Metric**: `session_verification_error`
**Location**: Verification page (app/auth/verify-session)
**Expected**: <1% of verification attempts
**Alert Threshold**: >5% over 1 hour

**What it means**:
- Unexpected errors during verification
- May indicate API issues, network problems, etc.

## How to Monitor (Examples)

### Using grep in production logs:
```bash
# Count missing claims in last hour
grep "METRIC: jwt_claims_missing" logs.txt | wc -l

# Count verification successes
grep "METRIC: session_verification_success" logs.txt | wc -l

# Find verification failures
grep "METRIC: session_verification_failed" logs.txt
```

### Using log aggregation (Datadog, Sentry, etc.):
1. Filter logs by metric keys
2. Create dashboards with counts over time
3. Set up alerts based on thresholds above

## Expected Behavior

**Healthy System:**
- `jwt_claims_missing`: 1-10 per day (rare)
- `session_verification_success`: 95%+ of verification attempts
- `session_verification_failed`: <5% of verification attempts

**Unhealthy System:**
- `jwt_claims_missing`: >100 per day (JWT hook issues)
- `session_verification_success`: <90% (hook not recovering)
- `session_verification_failed`: >10% (users forced to re-login)

## Action Items Based on Metrics

**If `jwt_claims_missing` >5% of requests:**
→ Investigate JWT hook (Phase 4: Fix Local JWT Hook Issues)
→ Check Supabase logs for hook errors
→ Consider switching from pg-functions:// to HTTP hook

**If `session_verification_failed` >10%:**
→ Critical issue with JWT hook
→ May need to increase retry attempts or delay
→ Consider temporary rollback to database fallback

**If `session_verification_error` spikes:**
→ Check API availability
→ Check network issues
→ Review error messages in logs
