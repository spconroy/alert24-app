-- Fix RLS policies for team_groups and team_memberships tables
-- These tables have RLS enabled but no policies, causing access to be blocked

-- Add RLS policy for team_groups table
-- Users can access teams that belong to organizations they are members of
CREATE POLICY team_groups_organization_isolation ON team_groups
    FOR ALL TO alert24
    USING (organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

-- Add RLS policy for team_memberships table  
-- Users can access team memberships for teams in organizations they belong to
CREATE POLICY team_memberships_organization_isolation ON team_memberships
    FOR ALL TO alert24
    USING (team_group_id IN (
        SELECT id FROM team_groups 
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    ));

-- Also add a simpler policy for team_memberships to allow users to see their own memberships
CREATE POLICY team_memberships_user_access ON team_memberships
    FOR ALL TO alert24
    USING (user_id = current_setting('app.current_user_id')::UUID);