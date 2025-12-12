# Email Preferences Storage Implementation Plan

## Overview

Implement database storage for user email preferences, starting with a single `feature_updates` preference. The preferences are currently managed in local component state (components/profile/tabs/settings-tab.tsx:18) and reset on every page load.

## Current State Analysis

**Settings Tab Component:**
- Location: `components/profile/tabs/settings-tab.tsx`
- Line 18: `emailNotifications` state exists but is not persisted
- Lines 25-38: `handleSaveSettings` has TODO comment - only simulates save
- Line 54-66: Email notification toggle UI exists
- **Problem**: Component receives no props (line 117 of parent), cannot access user ID or persist data

**Database:**
- No email preferences table exists
- Profile table (db/schema.ts:28-96) contains only core profile and billing fields
- No columns for email preferences

**Query Pattern Validation:**
- ✅ Separate table justified: 15+ queries fetch profile data for billing/handicap checks
- Email preferences would be fetched unnecessarily in most profile queries
- Only needed when sending emails or managing settings

## Desired End State

After implementation:
1. ✅ `email_preferences` table exists in database
2. ✅ Single `feature_updates` boolean column with default `true`
3. ✅ Settings tab loads preferences from database on mount
4. ✅ Save button persists preferences to database via tRPC
5. ✅ Preferences persist across sessions
6. ✅ New users get default value automatically

**Verification:**
- Run `pnpm drizzle-kit push` or apply migration successfully
- Toggle preference, save, refresh page - preference persists
- Check new user has `feature_updates = true` by default
- No TypeScript or build errors

## What We're NOT Doing

- Additional preference types beyond `feature_updates` (will add later as needed)
- Email sending infrastructure (future work)
- Admin override of preferences
- Preference change history/audit log
- Unsubscribe functionality

## Implementation Approach

1. **Schema-first**: Define table in Drizzle schema, generate SQL migration
2. **Backend**: Create tRPC mutation for updating preferences
3. **Frontend**: Update settings tab to fetch and persist preferences
4. **Integration**: Connect parent component to pass required props

---

## Phase 1: Database Schema & Migration

### Overview

Create `email_preferences` table with RLS policies and generate migration from schema changes.

### Changes Required:

#### 1. Add Email Preferences Table to Schema

**File**: `db/schema.ts`
**Location**: After `profile` table definition (after line 96)
**Changes**: Add new table definition

```typescript
export const emailPreferences = pgTable(
  "email_preferences",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    featureUpdates: boolean("feature_updates").default(true).notNull(),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profile.id],
      name: "email_preferences_user_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("Users can view their own email preferences", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can insert their own email preferences", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can update their own email preferences", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
    pgPolicy("Users can delete their own email preferences", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`(auth.uid()::uuid = user_id)`,
    }),
  ]
);

export const emailPreferencesSchema = createSelectSchema(emailPreferences);
export type EmailPreferences = InferSelectModel<typeof emailPreferences>;
```

**Why these fields:**
- `id`: Standard UUID primary key
- `userId`: Links to profile, unique constraint ensures one row per user
- `featureUpdates`: The single preference we're implementing now
- `createdAt`/`updatedAt`: Standard audit fields for tracking changes
- Foreign key with cascade delete: When user deleted, preferences deleted too
- RLS policies: Users can only access their own preferences

#### 2. Generate Migration

**Command**:
```bash
pnpm drizzle-kit generate
```

**Expected output**: New file in `supabase/migrations/` with timestamp prefix

**Migration will include:**
- `CREATE TABLE email_preferences` statement
- Foreign key constraint to profile table
- Unique constraint on user_id
- Index on user_id for query performance
- RLS policies (CREATE POLICY statements)
- ALTER TABLE statement to enable RLS

#### 3. Review and Apply Migration

**Review**:
- Open generated migration file in `supabase/migrations/`
- Verify table structure matches schema definition
- Ensure RLS policies are present
- Check statement breakpoints are properly placed

**Apply** (choose one method):
```bash
# Method 1: Push directly to database (local dev)
pnpm drizzle-kit push

# Method 2: Use Supabase CLI (recommended)
supabase db push

# Method 3: Apply migration file directly
psql $DATABASE_URL -f supabase/migrations/YYYYMMDD_email_preferences.sql
```

### Success Criteria:

#### Automated Verification:
- [x] Schema file has no TypeScript errors: `pnpm tsc --noEmit`
- [x] Migration file generated successfully in `supabase/migrations/`
- [x] Migration applies without errors

#### Manual Verification:
- [x] Query database to verify table exists: `SELECT * FROM email_preferences LIMIT 1;`
- [x] Verify RLS enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'email_preferences';`
- [x] Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'email_preferences';`
- [x] Verify foreign key constraint exists

---

## Phase 2: tRPC Backend Implementation

### Overview

Create tRPC queries and mutations for fetching and updating email preferences.

### Changes Required:

#### 1. Add Email Preferences Router Operations

**File**: `server/api/routers/auth.ts`
**Location**: After existing mutations (after line 53)
**Changes**: Add two new procedures

```typescript
// Get email preferences for authenticated user
getEmailPreferences: authedProcedure
  .input(z.object({ userId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", input.userId)
      .single();

    if (error) {
      // If no preferences exist yet, return defaults
      if (error.code === "PGRST116") {
        return {
          id: null,
          user_id: input.userId,
          feature_updates: true,
          created_at: null,
          updated_at: null,
        };
      }

      console.error("Error fetching email preferences:", error);
      throw new Error(`Error fetching email preferences: ${error.message}`);
    }

    return data;
  }),

// Update or insert email preferences
updateEmailPreferences: authedProcedure
  .input(
    z.object({
      userId: z.string().uuid(),
      featureUpdates: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Use upsert to handle both insert and update cases
    const { data, error } = await ctx.supabase
      .from("email_preferences")
      .upsert(
        {
          user_id: input.userId,
          feature_updates: input.featureUpdates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating email preferences:", error);
      throw new Error(`Error updating email preferences: ${error.message}`);
    }

    return data;
  }),
```

**Why upsert:**
- Handles first-time save (insert) and subsequent saves (update) with one operation
- Avoids need to check if preferences exist before saving
- Simpler client code

**Error handling:**
- Returns default values if preferences don't exist yet (PGRST116 = not found)
- Logs errors for debugging
- Throws errors that tRPC will return to client

#### 2. Update Types

**File**: `types/supabase.ts` (auto-generated)
**Action**: No manual changes needed - types regenerate after migration

After migration, the types will automatically include:
```typescript
export interface Database {
  public: {
    Tables: {
      email_preferences: {
        Row: {
          id: string;
          user_id: string;
          feature_updates: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature_updates?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature_updates?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // ... other tables
    };
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors in auth router: `pnpm tsc --noEmit`
- [x] Build succeeds: `pnpm build`

#### Manual Verification:
- [x] Test query returns defaults for new user (no DB row yet)
- [x] Test mutation creates row on first save
- [x] Test mutation updates existing row on subsequent saves
- [x] Verify RLS policies prevent accessing other users' preferences

---

## Phase 3: Settings Tab Frontend Updates

### Overview

Update SettingsTab component to accept props, fetch preferences on mount, and persist changes via tRPC.

### Changes Required:

#### 1. Update Component Props and State

**File**: `components/profile/tabs/settings-tab.tsx`
**Lines**: 10-18
**Changes**: Add props interface and update state initialization

```typescript
interface SettingsTabProps {
  userId: string;
}

export function SettingsTab({ userId }: SettingsTabProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Notification preferences - will be loaded from database
  const [featureUpdates, setFeatureUpdates] = useState(true);
```

**Changes:**
- Add `SettingsTabProps` interface with `userId`
- Rename state from `emailNotifications` to `featureUpdates`
- Component now accepts props

#### 2. Add tRPC Hooks

**File**: `components/profile/tabs/settings-tab.tsx`
**Location**: After state declarations (after line 18)
**Changes**: Add query and mutation hooks

```typescript
// Fetch email preferences on mount
const { data: preferences, isLoading } = api.auth.getEmailPreferences.useQuery(
  { userId },
  {
    enabled: !!userId,
    refetchOnWindowFocus: false,
  }
);

// Update preferences mutation
const { mutate: updatePreferences } = api.auth.updateEmailPreferences.useMutation({
  onSuccess: () => {
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
    setSaveState("idle");
  },
});

// Sync state with fetched preferences
useEffect(() => {
  if (preferences) {
    setFeatureUpdates(preferences.feature_updates);
  }
}, [preferences]);
```

**Note**: Need to add toast import:
```typescript
import { useToast } from "@/hooks/use-toast";
```

And in component body:
```typescript
const { toast } = useToast();
```

#### 3. Implement Save Logic

**File**: `components/profile/tabs/settings-tab.tsx`
**Lines**: 25-38
**Changes**: Replace TODO with actual mutation call

```typescript
const handleSaveSettings = async () => {
  setSaveState("saving");

  updatePreferences({
    userId,
    featureUpdates,
  });
};
```

**Simplified logic:**
- Set saving state
- Call mutation with userId and current preference value
- Mutation callbacks handle success/error states

#### 4. Update UI Labels and Bindings

**File**: `components/profile/tabs/settings-tab.tsx`
**Lines**: 54-66
**Changes**: Update labels and state bindings

```typescript
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label htmlFor="feature-updates">Feature Updates</Label>
    <p className="text-sm text-muted-foreground">
      Receive emails about new features and improvements
    </p>
  </div>
  <Switch
    id="feature-updates"
    checked={featureUpdates}
    onCheckedChange={setFeatureUpdates}
    disabled={isLoading}
  />
</div>
```

**Changes:**
- Updated ID from `email-notifications` to `feature-updates`
- Updated label from "Email Notifications" to "Feature Updates"
- Updated description to be more specific
- Changed binding from `emailNotifications` to `featureUpdates`
- Added `disabled={isLoading}` to prevent changes while loading

#### 5. Add Loading State

**File**: `components/profile/tabs/settings-tab.tsx`
**Location**: Inside notifications section (after line 53)
**Changes**: Show loading skeleton while fetching

```typescript
{/* Notifications Section */}
<div className="bg-card rounded-lg border p-6">
  <h3 className="text-xl font-semibold mb-4">Notifications</h3>
  {isLoading ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-pulse">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
        <div className="h-6 w-11 bg-muted rounded-full" />
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      {/* Existing toggle code */}
    </div>
  )}
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm tsc --noEmit`
- [x] Component renders without errors: `pnpm dev`
- [x] No console errors when loading settings tab

#### Manual Verification:
- [x] Preferences load from database on mount
- [x] Toggle switch reflects database value
- [x] Changing toggle and saving persists to database
- [x] Refreshing page loads saved preference
- [x] Loading skeleton shows while fetching
- [x] Error toast appears if save fails
- [x] Success state (green checkmark) shows after save

---

## Phase 4: Parent Component Integration

### Overview

Update parent component to pass userId prop to SettingsTab.

### Changes Required:

#### 1. Pass Props to SettingsTab

**File**: `components/profile/tabbed-profile-page.tsx`
**Line**: 117
**Changes**: Pass authUser.id as prop

```typescript
{activeTab === "settings" && <SettingsTab userId={authUser.id} />}
```

**Simple change:**
- SettingsTab currently receives no props
- Now passes `authUser.id` which is already available in parent component
- Enables SettingsTab to fetch and update user's preferences

### Success Criteria:

#### Automated Verification:
- [x] No TypeScript errors: `pnpm tsc --noEmit`
- [x] Build succeeds: `pnpm build`

#### Manual Verification:
- [x] Settings tab renders correctly
- [x] UserId prop is passed and received correctly
- [x] No prop-types warnings in console

---

## Testing Strategy

### Unit Tests

Not required for this implementation - focus on integration and manual testing.

### Integration Tests

**Scenario 1: New User (No Preferences Exist)**
1. Create new test user account
2. Navigate to Settings tab
3. Verify toggle shows default state (enabled)
4. Toggle off, save
5. Verify database row created with `feature_updates = false`
6. Refresh page
7. Verify toggle remains off

**Scenario 2: Existing User**
1. User with existing preferences
2. Navigate to Settings tab
3. Verify toggle reflects database value
4. Change preference, save
5. Verify `updated_at` timestamp updated in database
6. Verify `feature_updates` value updated

**Scenario 3: Error Handling**
1. Simulate network error (disconnect)
2. Try to save preferences
3. Verify error toast appears
4. Verify button returns to idle state
5. Reconnect and verify save works

### Manual Testing Steps

1. **Fresh User Flow:**
   - Create new account
   - Go to profile settings
   - Verify "Feature Updates" toggle is ON by default
   - Click Save Changes
   - Check database - verify row created with `feature_updates = true`

2. **Toggle and Persistence:**
   - Toggle OFF
   - Click Save Changes
   - Wait for green "Saved!" confirmation
   - Refresh page (F5)
   - Verify toggle is still OFF

3. **Multiple Updates:**
   - Toggle ON, save
   - Toggle OFF, save
   - Toggle ON, save
   - Check database - verify single row with latest value
   - Check `updated_at` timestamp updated each time

4. **Cross-Session Persistence:**
   - Set preference
   - Save
   - Log out
   - Log back in
   - Navigate to settings
   - Verify preference persisted

5. **Loading States:**
   - Open settings tab
   - Observe loading skeleton briefly appears
   - Verify smooth transition to loaded state
   - Verify no flickering or layout shift

## Performance Considerations

- **Query caching**: tRPC query cached by default, won't refetch unnecessarily
- **Single table join**: When needed, joining email_preferences to profile is efficient (indexed on user_id)
- **Upsert efficiency**: Single operation handles both insert and update
- **No N+1 queries**: One query per user, not per preference

## Migration Notes

**For Existing Users:**
- No data migration needed
- Users without email_preferences rows will get defaults on first query
- First save will create the row via upsert
- No breaking changes to existing functionality

**Rollback Plan:**
- If needed, can drop `email_preferences` table
- No foreign key from profile to email_preferences (one-way FK only)
- Safe to revert migration

## References

- Original ticket: `.claude/tickets/0030-email-preferences-storage.md`
- Settings Tab: `components/profile/tabs/settings-tab.tsx`
- Personal Info Tab (example): `components/profile/tabs/personal-information-tab.tsx:47-64`
- Auth Router: `server/api/routers/auth.ts`
- Schema: `db/schema.ts`
- Migration rules: `.claude/rules/create-migration.md`
