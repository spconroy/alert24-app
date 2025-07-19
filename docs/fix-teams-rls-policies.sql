-- Fix RLS policies for team_groups and team_memberships tables
-- These policies need to work with API-level authorization since we don't have user context in API routes

-- Drop existing policies
DROP POLICY IF EXISTS team_groups_organization_isolation ON team_groups;
DROP POLICY IF EXISTS team_memberships_organization_isolation ON team_memberships;
DROP POLICY IF EXISTS team_memberships_user_access ON team_memberships;

-- Create more permissive policies that work with API-level auth
-- Since we're doing authorization checks in the API, we can be more permissive here

-- Allow all authenticated users to manage teams (API will handle org-level authorization)
CREATE POLICY team_groups_api_access ON team_groups
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY team_memberships_api_access ON team_memberships
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Alternative: If you want to keep organization isolation, but need it to work without auth.uid()
-- You could also completely disable RLS for these tables since API handles authorization:
-- ALTER TABLE team_groups DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_memberships DISABLE ROW LEVEL SECURITY;

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('team_groups', 'team_memberships'); 