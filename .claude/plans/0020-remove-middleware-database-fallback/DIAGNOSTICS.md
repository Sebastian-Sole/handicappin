# JWT Claims Missing - Diagnostic Guide

## What You'll See in the Logs

After deploying these changes, when a user hits the verification page, you'll see detailed diagnostic logs that will help identify the root cause.

## Possible Scenarios

### Scenario 1: JWT Hook Not Configured in Production

**Logs you'll see:**
```
🔍 Refresh session result: { hasAppMetadata: true, hasBilling: false, ... }
🔍 Full app_metadata: { provider: 'email', providers: ['email'] }
🔍 app_metadata keys: ['provider', 'providers']
🔍 Profile exists in database: { id: '...', plan_selected: 'lifetime', ... }
```

**What this means:**
- app_metadata exists but has NO billing data
- Profile exists in database with correct plan
- **JWT hook is NOT configured or NOT running in production**

**How to fix:**
1. Go to Supabase Dashboard → Authentication → Hooks
2. Enable "Custom Access Token Hook"
3. Set URI to: `pg-functions://postgres/public/custom_access_token_hook`
4. Save and test

---

### Scenario 2: Profile Doesn't Exist

**Logs you'll see:**
```
🔍 Refresh session result: { hasAppMetadata: true, hasBilling: false, ... }
🔍 Full app_metadata: { billing: { plan: null, status: null, ... } }
🚨 Profile query error: { code: 'PGRST116', message: 'No rows found' }
```

**What this means:**
- JWT hook IS running
- billing exists but all values are null
- No profile row in database

**How to fix:**
```sql
-- Check if profile exists
SELECT * FROM profile WHERE id = '<user-id>';

-- If not, investigate why the signup edge function didn't create it
-- Check edge function logs
```

---

### Scenario 3: Profile Exists But Plan Is NULL

**Logs you'll see:**
```
🔍 Profile exists in database: { id: '...', plan_selected: null, ... }
⚠️ Profile exists but plan_selected is NULL - user needs onboarding
```

**What this means:**
- Profile exists
- User hasn't selected a plan OR webhook failed to update it

**How to fix:**
1. Check if webhook was received: `SELECT * FROM webhook_events WHERE user_id = '<user-id>' ORDER BY processed_at DESC;`
2. If webhook succeeded but plan is null, webhook might have failed to UPDATE
3. Check webhook logs for errors

---

### Scenario 4: Everything Exists But Claims Still Missing

**Logs you'll see:**
```
🔍 Profile exists in database: { id: '...', plan_selected: 'lifetime', ... }
🔍 Full app_metadata: { provider: 'email', providers: ['email'] }
🔍 app_metadata keys: ['provider', 'providers']
```

**What this means:**
- Profile is correct
- JWT hook configured but not adding billing claims

**How to fix:**
1. Check JWT hook function exists in production:
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'custom_access_token_hook';
```

2. Test JWT hook manually:
```sql
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', '<user-id>',
    'claims', jsonb_build_object(
      'sub', '<user-id>',
      'aud', 'authenticated',
      'role', 'authenticated'
    )
  )
);
```

3. Check permissions:
```sql
SELECT has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE');
SELECT has_table_privilege('supabase_auth_admin', 'public.profile', 'SELECT');
```

---

### Scenario 5: Middleware Sees Different Data Than Client

**Logs you'll see in middleware:**
```
❌ Missing JWT claims for user 559b8449-badc-4f0b-961b-d83ac2256ed7
hasAppMetadata: true
appMetadataKeys: ['provider', 'providers']
```

**Logs you'll see in client:**
```
🔍 Full app_metadata: { billing: { plan: 'lifetime', status: 'active', ... } }
```

**What this means:**
- Client sees billing claims after refresh
- Middleware doesn't see them (timing issue or cache)

**How to fix:**
- User should do a hard refresh after verification
- Check if middleware is reading from stale cookie
- Verify middleware is getting the updated session

---

## Quick Diagnostic Checklist

Run these in Supabase SQL Editor:

```sql
-- 1. Check if JWT hook function exists
SELECT proname FROM pg_proc WHERE proname = 'custom_access_token_hook';

-- 2. Check if profile exists for user
SELECT * FROM profile WHERE id = '<user-id>';

-- 3. Test JWT hook manually
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', '<user-id>',
    'claims', jsonb_build_object('sub', '<user-id>', 'aud', 'authenticated', 'role', 'authenticated')
  )
);

-- 4. Check webhook processed successfully
SELECT * FROM webhook_events WHERE user_id = '<user-id>' ORDER BY processed_at DESC LIMIT 5;

-- 5. Check permissions
SELECT
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') as can_execute,
  has_table_privilege('supabase_auth_admin', 'public.profile', 'SELECT') as can_select;
```

---

## Next Steps After Identifying Issue

1. **If JWT hook not configured**: Configure it in Supabase Dashboard
2. **If profile missing**: Investigate signup flow
3. **If webhook failed**: Check webhook logs and fix webhook
4. **If permissions wrong**: Grant permissions and redeploy
5. **After fixing**: Have user logout, clear cookies, and login again
