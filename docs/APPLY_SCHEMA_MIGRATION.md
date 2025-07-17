# Apply Schema Migration Instructions

## Overview

A comprehensive schema migration has been created at `docs/schema-updates/12_missing_columns_and_fixes.sql` that addresses:

- ✅ **Missing auto_recovery column** in services table (from todos)
- ✅ **Profile management enhancements** for users table
- ✅ **Invitation system improvements** for organization_members table
- ✅ **Status page enhancements** for better public access
- ✅ **Missing notification tables** (notification_rules, notification_history)
- ✅ **Subscription improvements** with unsubscribe functionality
- ✅ **Performance indexes** for better query performance
- ✅ **Automation functions and triggers** for data management

## Apply the Migration

### Option 1: Direct psql Command

```bash
psql postgresql://alert24:Sg47%5EkLm9%40wPz%21rT@34.223.13.196:5432/alert24 -f docs/schema-updates/12_missing_columns_and_fixes.sql
```

### Option 2: Interactive psql Session

```bash
# Connect to database
psql postgresql://alert24:Sg47%5EkLm9%40wPz%21rT@34.223.13.196:5432/alert24

# Run the migration file
\i docs/schema-updates/12_missing_columns_and_fixes.sql

# Exit
\q
```

### Option 3: Copy and Paste

1. Open the migration file: `docs/schema-updates/12_missing_columns_and_fixes.sql`
2. Copy the entire contents
3. Connect to your database interface (pgAdmin, DBeaver, etc.)
4. Paste and execute the SQL

## What This Migration Does

### 1. Missing Columns Added ✅

- `services.auto_recovery` - Boolean for automatic incident recovery
- `users.profile_completed` - Tracks if user completed profile setup
- `users.profile_completion_percentage` - Percentage of profile completion
- `organization_members.invitation_email` - Email for pending invitations
- `organization_members.invitation_status` - Status of invitations
- `status_pages.is_public` - Whether status page is publicly accessible
- `status_pages.seo_title` - Custom SEO title
- `status_pages.seo_description` - Custom SEO description
- `status_pages.custom_css` - Custom CSS for branding
- `status_pages.favicon_url` - Custom favicon URL
- `subscriptions.unsubscribe_token` - Token for unsubscribe links
- `subscriptions.unsubscribed_at` - When subscription was cancelled
- `subscriptions.notification_preferences` - User notification preferences

### 2. New Tables Created ✅

- **notification_rules** - Rules for escalation policy notifications
- **notification_history** - Track all sent notifications

### 3. Functions and Triggers Added ✅

- **generate_unsubscribe_token()** - Auto-generates unsubscribe tokens
- **calculate_profile_completion()** - Calculates user profile completion percentage
- **update_profile_completion()** - Auto-updates profile completion on user changes

### 4. Performance Indexes Added ✅

- Indexes on all foreign key relationships
- Specialized indexes for notification tracking
- Partial indexes for active records

### 5. Data Updates ✅

- Updates existing users with profile completion percentages
- Generates unsubscribe tokens for existing subscriptions
- Sets proper invitation status for existing organization members

## Verification

After applying the migration, run these commands to verify:

```sql
-- Check that auto_recovery column was added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'services' AND column_name = 'auto_recovery';

-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('notification_rules', 'notification_history');

-- Check profile completion was calculated
SELECT name, profile_completion_percentage, profile_completed
FROM users LIMIT 5;

-- Check unsubscribe tokens were generated
SELECT COUNT(*) as tokens_generated
FROM subscriptions WHERE unsubscribe_token IS NOT NULL;
```

## Next Steps After Migration

Once the schema migration is applied, the following functionality improvements will be available:

1. **Auto-recovery for services** - Services can automatically recover from incidents
2. **Profile completion tracking** - Users can see their profile completion status
3. **Better invitation system** - Track invitation status and handle pending invitations
4. **Enhanced status pages** - Public access controls and SEO improvements
5. **Notification system** - Proper escalation and notification tracking
6. **Subscription management** - Unsubscribe functionality and preferences

## Rollback (if needed)

If you need to rollback the migration, here are the key commands:

```sql
-- Remove new columns (use carefully)
ALTER TABLE services DROP COLUMN IF EXISTS auto_recovery;
ALTER TABLE users DROP COLUMN IF EXISTS profile_completed;
ALTER TABLE users DROP COLUMN IF EXISTS profile_completion_percentage;

-- Drop new tables
DROP TABLE IF EXISTS notification_history;
DROP TABLE IF EXISTS notification_rules;

-- Remove functions
DROP FUNCTION IF EXISTS generate_unsubscribe_token();
DROP FUNCTION IF EXISTS calculate_profile_completion(UUID);
DROP FUNCTION IF EXISTS update_profile_completion();
```

⚠️ **Warning**: Only rollback if absolutely necessary, as this will lose data in the new tables and columns.

## Support

If you encounter any issues:

1. Check PostgreSQL logs for specific error messages
2. Ensure you have proper permissions on the database
3. Verify the database connection is working
4. Make sure the alert24 user has sufficient privileges

The migration includes `IF NOT EXISTS` clauses for safety and can be safely re-run if needed.
