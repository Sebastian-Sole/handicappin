# 0030 - Email Preferences Storage

## 🎯 **Description**

Implement database storage for user email preferences currently managed in the profile settings tab.

## 📋 **User Story**

As a user, I want my email notification preferences to persist across sessions so that I don't have to reconfigure them every time I visit the settings page.

## 🔧 **Technical Context**

The settings tab (components/profile/tabs/settings-tab.tsx:18-20) currently has three email preference toggles:
- Email Notifications (default: true)
- Round Reminders (default: false)
- Weekly Digest (default: true)

These are stored in component state only and have a TODO comment about implementing save logic (line 30). The profile schema (db/schema.ts:28-88) needs to be extended to store these preferences.

## ✅ **Acceptance Criteria**

- [x] Add email preference columns to profile table schema
- [x] Create and run database migration
- [x] Preferences load from database on settings tab mount
- [x] Save button persists preferences to database
- [x] Preferences persist across sessions
- [x] Default values match current component defaults

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Schema Changes (db/schema.ts)**
```typescript
// Add to profile table definition
emailNotifications: boolean().default(true).notNull(),
roundReminders: boolean().default(false).notNull(),
weeklyDigest: boolean().default(true).notNull(),
```

**2. Settings Tab Updates**
- Replace local state initialization with props/fetch from profile
- Implement actual save logic in handleSaveSettings (currently TODO at line 30)
- Use tRPC or API route to persist changes

**3. Type Updates**
- Regenerate Supabase types after migration
- Update profile type inference

### **Dependencies**

- `db/schema.ts` - Profile table definition
- `components/profile/tabs/settings-tab.tsx` - Settings UI
- Database migration system (Drizzle)
- Profile data fetching mechanism

### **Integration Points**

- Profile page passes profile data to tabbed-profile-page.tsx
- Settings tab needs access to profile data and update mechanism
- Future: Email service will query these preferences before sending

## 🔍 **Implementation Notes**

- Follow existing billing field patterns (lines 42-49) for naming convention
- Use snake_case for DB columns (email_notifications, round_reminders, weekly_digest)
- Maintain existing RLS policies - users can only update their own preferences
- Consider whether to invalidate/refetch profile after save or use optimistic updates

## 📊 **Definition of Done**

- [x] Migration applied successfully to database
- [x] Preferences save and load correctly
- [x] No console errors or type errors
- [x] Settings persist after logout/login
- [x] Default values work for new users

## 🧪 **Testing Requirements**

- [x] Test new user gets correct defaults
- [x] Test preferences save and persist across sessions
- [x] Test each toggle saves independently
- [x] Test save button disabled states work correctly
- [x] Verify RLS policies allow users to update only their preferences

## 🚫 **Out of Scope**

- Email sending infrastructure
- Additional preference types beyond the three existing toggles
- Email template management
- Unsubscribe functionality
- Admin override of user preferences

## 📝 **Notes**

Theme preference is already handled by next-themes and doesn't need database storage as it uses localStorage. Only the three email-related preferences need database backing.

## 🏷️ **Labels**

- `priority: medium`
- `type: feature`
- `component: profile`
- `component: database`
- `area: notifications`
