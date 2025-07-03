-- Alert24 Database Schema Verification Script
-- Run this to verify all tables, indexes, functions, and views were created properly
-- Updated for alert24_schema

-- Set search path to use the alert24_schema
SET search_path TO alert24_schema, public;

-- ============================================================================
-- VERIFY SCHEMA
-- ============================================================================

-- Check if schema exists
SELECT 'Schema Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) = 1 THEN '✅ alert24_schema created successfully'
           ELSE '❌ alert24_schema not found'
       END as status
FROM information_schema.schemata 
WHERE schema_name = 'alert24_schema';

-- ============================================================================
-- VERIFY TABLES
-- ============================================================================

-- Check if all core tables exist
SELECT 'Tables Check' as check_type, 
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) = 11 THEN '✅ All tables created successfully'
           ELSE '❌ Missing tables - Expected 11, found ' || COUNT(*)
       END as status
FROM information_schema.tables 
WHERE table_schema = 'alert24_schema' 
AND table_name IN (
    'organizations',
    'users', 
    'organization_members',
    'notifications',
    'realtime_channels',
    'activity_history',
    'subscription_plans',
    'billing_history',
    'projects',
    'project_members',
    'user_sessions'
);

-- List all tables with their column counts
SELECT 'Table Details' as check_type,
       table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'alert24_schema') as column_count
FROM information_schema.tables t
WHERE table_schema = 'alert24_schema' 
AND table_name IN (
    'organizations',
    'users', 
    'organization_members',
    'notifications',
    'realtime_channels',
    'activity_history',
    'subscription_plans',
    'billing_history',
    'projects',
    'project_members',
    'user_sessions'
)
ORDER BY table_name;

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================

-- Check if all indexes exist
SELECT 'Indexes Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) >= 25 THEN '✅ All indexes created successfully'
           ELSE '❌ Missing indexes - Expected 25+, found ' || COUNT(*)
       END as status
FROM pg_indexes 
WHERE schemaname = 'alert24_schema' 
AND indexname LIKE 'idx_%';

-- List all indexes
SELECT 'Index Details' as check_type,
       tablename,
       indexname,
       indexdef
FROM pg_indexes 
WHERE schemaname = 'alert24_schema' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- VERIFY FUNCTIONS
-- ============================================================================

-- Check if all functions exist
SELECT 'Functions Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) >= 4 THEN '✅ All functions created successfully'
           ELSE '❌ Missing functions - Expected 4+, found ' || COUNT(*)
       END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'alert24_schema'
AND p.proname IN (
    'update_updated_at_column',
    'get_user_organizations',
    'log_activity',
    'create_notification'
);

-- List all functions
SELECT 'Function Details' as check_type,
       p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'alert24_schema'
AND p.proname IN (
    'update_updated_at_column',
    'get_user_organizations',
    'log_activity',
    'create_notification'
)
ORDER BY p.proname;

-- ============================================================================
-- VERIFY TRIGGERS
-- ============================================================================

-- Check if all triggers exist
SELECT 'Triggers Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) >= 6 THEN '✅ All triggers created successfully'
           ELSE '❌ Missing triggers - Expected 6+, found ' || COUNT(*)
       END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'alert24_schema'
AND t.tgname LIKE '%updated_at%';

-- List all triggers
SELECT 'Trigger Details' as check_type,
       c.relname as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'alert24_schema'
AND t.tgname LIKE '%updated_at%'
ORDER BY c.relname, t.tgname;

-- ============================================================================
-- VERIFY VIEWS
-- ============================================================================

-- Check if all views exist
SELECT 'Views Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) = 2 THEN '✅ All views created successfully'
           ELSE '❌ Missing views - Expected 2, found ' || COUNT(*)
       END as status
FROM information_schema.views 
WHERE table_schema = 'alert24_schema'
AND table_name IN ('organization_dashboard', 'user_dashboard');

-- List all views
SELECT 'View Details' as check_type,
       table_name,
       view_definition
FROM information_schema.views 
WHERE table_schema = 'alert24_schema'
AND table_name IN ('organization_dashboard', 'user_dashboard')
ORDER BY table_name;

-- ============================================================================
-- VERIFY EXTENSIONS
-- ============================================================================

-- Check if required extensions are installed
SELECT 'Extensions Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) = 2 THEN '✅ All extensions installed successfully'
           ELSE '❌ Missing extensions - Expected 2, found ' || COUNT(*)
       END as status
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- List all extensions
SELECT 'Extension Details' as check_type,
       extname as extension_name,
       extversion as version
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'pgcrypto')
ORDER BY extname;

-- ============================================================================
-- VERIFY INITIAL DATA
-- ============================================================================

-- Check if subscription plans were inserted
SELECT 'Initial Data Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) = 3 THEN '✅ Subscription plans created successfully'
           ELSE '❌ Missing subscription plans - Expected 3, found ' || COUNT(*)
       END as status
FROM alert24_schema.subscription_plans;

-- List subscription plans
SELECT 'Subscription Plans' as check_type,
       name,
       description,
       price_monthly,
       price_yearly,
       max_team_members,
       max_projects
FROM alert24_schema.subscription_plans
ORDER BY price_monthly;

-- ============================================================================
-- VERIFY CONSTRAINTS
-- ============================================================================

-- Check foreign key constraints
SELECT 'Foreign Key Check' as check_type,
       COUNT(*) as count,
       CASE 
           WHEN COUNT(*) >= 10 THEN '✅ Foreign key constraints created successfully'
           ELSE '❌ Missing foreign key constraints - Expected 10+, found ' || COUNT(*)
       END as status
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'alert24_schema';

-- List foreign key constraints
SELECT 'Foreign Key Details' as check_type,
       tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'alert24_schema'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- VERIFY SCHEMA PERMISSIONS
-- ============================================================================

-- Check schema permissions
SELECT 'Schema Permissions Check' as check_type,
       nspname as schema_name,
       nspowner::regrole as owner
FROM pg_namespace 
WHERE nspname = 'alert24_schema';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT 'SCHEMA VERIFICATION COMPLETE' as summary,
       'Run the above queries to verify all components were created properly in alert24_schema' as instructions,
       'Expected: 1 schema, 11+ tables, 25+ indexes, 4+ functions, 6+ triggers, 2 views, 2 extensions, 3 subscription plans' as expected_counts; 