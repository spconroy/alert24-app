-- Quick Fix for RLS Policy Issues
-- Run this in Supabase SQL Editor to temporarily fix the infinite recursion errors

-- Disable Row Level Security on problematic tables temporarily
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates DISABLE ROW LEVEL SECURITY;

-- Drop any existing problematic policies
DROP POLICY IF EXISTS "Organization members can view org" ON organizations;
DROP POLICY IF EXISTS "Organization members can view membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can view their memberships" ON organization_members;

-- Insert some basic test data if tables are empty
-- Check if we have any organizations
DO $$
DECLARE
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    
    IF org_count = 0 THEN
        -- Insert test organization
        INSERT INTO organizations (id, name, slug, subscription_plan, max_team_members, max_projects) 
        VALUES (
            '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
            'Demo Organization', 
            'demo-org',
            'free',
            3,
            5
        ) ON CONFLICT (id) DO NOTHING;
        
        -- Insert test user
        INSERT INTO users (id, email, name, timezone, language) 
        VALUES (
            '3b3e5e75-a6ca-4680-83b0-35455901f1d1',
            'demo@alert24.com',
            'Demo User',
            'UTC',
            'en'
        ) ON CONFLICT (id) DO NOTHING;
        
        -- Insert membership
        INSERT INTO organization_members (organization_id, user_id, role, is_active) 
        VALUES (
            '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
            '3b3e5e75-a6ca-4680-83b0-35455901f1d1',
            'owner',
            true
        ) ON CONFLICT (organization_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Inserted demo organization and user';
    END IF;
END $$;

SELECT 'RLS temporarily disabled and demo data inserted if needed' as message; 