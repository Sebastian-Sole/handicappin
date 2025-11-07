# How to Verify JWT Hook is Executing

## 🔍 Method 1: Check Docker Logs (Easiest for Local)

Since your JWT hook now has logging, you can see it in the Supabase Docker logs:

```bash
# View all Supabase logs (auth service will show hook logs)
docker logs supabase_auth_handicappin 2>&1 | grep "JWT Hook"

# Follow logs in real-time
docker logs -f supabase_auth_handicappin 2>&1 | grep --line-buffered "JWT Hook"

# If that container name doesn't work, find it:
docker ps | grep auth
```

**What you should see when hook executes:**
```
🎣 JWT Hook called for user: e7eb8340-294c-4fe9-887b-499284a4d686
✅ JWT Hook: Profile found - plan: unlimited, status: active
✅ JWT Hook: Returning claims with billing data for user e7eb8340-294c-4fe9-887b-499284a4d686
```

**If hook is NOT running, you'll see NOTHING** in the logs.

---

## 🔍 Method 2: Test Hook Manually in SQL Editor

Go to http://localhost:54323 (Supabase Studio) → SQL Editor:

```sql
-- Test the hook directly
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', 'e7eb8340-294c-4fe9-887b-499284a4d686',
    'claims', jsonb_build_object(
      'sub', 'e7eb8340-294c-4fe9-887b-499284a4d686',
      'email', 'sebastian.solelt@gmail.com',
      'role', 'authenticated',
      'aud', 'authenticated'
    )
  )
);
```

**Expected output:**
```json
{
  "claims": {
    "sub": "e7eb8340-294c-4fe9-887b-499284a4d686",
    "email": "sebastian.solelt@gmail.com",
    "role": "authenticated",
    "aud": "authenticated",
    "app_metadata": {
      "billing": {
        "plan": "unlimited",
        "status": "active",
        "current_period_end": null,
        "cancel_at_period_end": false,
        "billing_version": 2
      }
    }
  }
}
```

This proves the **function works**, but doesn't prove Supabase Auth is calling it.

---

## 🔍 Method 3: Check Middleware Logs

After logging in, the middleware will tell you what it received:

**If hook IS working:**
```
✅ Plan: unlimited, status: active
```

**If hook is NOT working (what we're seeing now):**
```
❌ Missing JWT claims for user e7eb8340-294c-4fe9-887b-499284a4d686
⚠️ LOCAL DEV: JWT hook not working, falling back to database query
```

---

## 🔍 Method 4: Inspect JWT Token Directly

In your browser console after login:

```javascript
// Get the session
const { data } = await (await fetch('http://localhost:3000/api/auth/session')).json();
console.log('JWT app_metadata:', data.session.user.app_metadata);
```

**If hook working:**
```javascript
{
  provider: 'email',
  providers: ['email'],
  billing: {  // ✅ This should be here!
    plan: 'unlimited',
    status: 'active',
    // ...
  }
}
```

**If hook NOT working:**
```javascript
{
  provider: 'email',
  providers: ['email']
  // ❌ No billing!
}
```

---

## 🔍 Method 5: Check if Hook is Configured

```bash
# Check the config file
cat supabase/config.toml | grep -A 3 "custom_access_token"
```

**Should show:**
```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

**Verify the function exists in the database:**

```sql
-- In SQL Editor
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'custom_access_token_hook';
```

Should return 1 row with the function definition.

---

## 🐛 Troubleshooting: If Hook is NOT Executing

### Issue 1: `pg-functions://` Not Working Locally

**Symptoms:**
- Hook function exists
- Hook is configured in `config.toml`
- Manual test works
- But NO logs appear when logging in

**Cause:** Known issue with local Supabase - `pg-functions://` hooks don't always work

**Fix:** Restart Supabase

```bash
supabase stop
supabase start
```

Then try logging in again and check Docker logs.

### Issue 2: Function Not Found

**Symptoms:**
```
ERROR: function custom_access_token_hook does not exist
```

**Fix:**
```bash
supabase db reset
```

### Issue 3: Permission Denied

**Symptoms:**
```
ERROR: permission denied for function custom_access_token_hook
```

**Fix:** Run in SQL Editor:
```sql
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profile TO supabase_auth_admin;
```

---

## ✅ Quick Verification Checklist

Run these in order:

1. **Check function exists:**
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'custom_access_token_hook';
   ```
   → Should return 1 row

2. **Test function manually:**
   ```sql
   SELECT public.custom_access_token_hook(
     jsonb_build_object(
       'user_id', '<your-user-id>',
       'claims', jsonb_build_object('sub', '<your-user-id>', 'aud', 'authenticated')
     )
   );
   ```
   → Should return claims with billing data

3. **Check config:**
   ```bash
   cat supabase/config.toml | grep -A 3 "custom_access_token"
   ```
   → Should show `enabled = true`

4. **Watch Docker logs and login:**
   ```bash
   docker logs -f supabase_auth_handicappin 2>&1 | grep --line-buffered "JWT Hook"
   ```
   Then login in another tab
   → Should see "🎣 JWT Hook called"

If step 1-3 pass but step 4 shows nothing, the hook is configured but Supabase Auth isn't calling it. This is the known `pg-functions://` issue.

---

## 🎯 Expected Behavior

**When working correctly:**

1. User logs in
2. Docker logs show: `🎣 JWT Hook called for user: <uuid>`
3. Docker logs show: `✅ JWT Hook: Profile found - plan: unlimited`
4. Docker logs show: `✅ JWT Hook: Returning claims with billing data`
5. Middleware logs show plan/status (no "Missing JWT claims")
6. User accesses dashboard without redirect

**When NOT working (current state):**

1. User logs in
2. Docker logs show NOTHING about JWT Hook
3. Middleware logs show: `❌ Missing JWT claims`
4. Middleware logs show: `⚠️ LOCAL DEV: JWT hook not working, falling back to database`
5. User accesses dashboard (via database fallback)
