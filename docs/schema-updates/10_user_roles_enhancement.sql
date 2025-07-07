-- Enhanced User Role Management Schema
-- This migration adds support for the four user role types:
-- Owner: Full control including organization settings and deletion
-- Admin: Manage everything except organization name/deletion and owners
-- Responder: Can view everything, manage incidents and service statuses
-- Stakeholder: Can view non-public status pages

-- First, update the role constraint to allow the new roles
ALTER TABLE public.organization_members 
DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE public.organization_members 
ADD CONSTRAINT organization_members_role_check 
CHECK (role IN ('owner', 'admin', 'responder', 'stakeholder'));

-- Add role descriptions for documentation
COMMENT ON CONSTRAINT organization_members_role_check ON public.organization_members IS 
'Role types: owner (full control), admin (manage all except org settings), responder (incidents and services), stakeholder (view only)';

-- Add helper function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_organization_id UUID,
    p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Get user role in organization
    SELECT om.role INTO user_role
    FROM public.organization_members om
    WHERE om.user_id = p_user_id 
      AND om.organization_id = p_organization_id 
      AND om.is_active = true;
    
    IF user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Permission matrix
    CASE p_permission
        WHEN 'manage_organization' THEN
            RETURN user_role = 'owner';
        WHEN 'manage_users' THEN
            RETURN user_role IN ('owner', 'admin');
        WHEN 'manage_owners' THEN
            RETURN user_role = 'owner';
        WHEN 'manage_incidents' THEN
            RETURN user_role IN ('owner', 'admin', 'responder');
        WHEN 'manage_services' THEN
            RETURN user_role IN ('owner', 'admin', 'responder');
        WHEN 'manage_monitoring' THEN
            RETURN user_role IN ('owner', 'admin');
        WHEN 'manage_escalation_policies' THEN
            RETURN user_role IN ('owner', 'admin');
        WHEN 'view_organization' THEN
            RETURN user_role IN ('owner', 'admin', 'responder', 'stakeholder');
        WHEN 'view_status_pages' THEN
            RETURN user_role IN ('owner', 'admin', 'responder', 'stakeholder');
        WHEN 'update_service_status' THEN
            RETURN user_role IN ('owner', 'admin', 'responder');
        WHEN 'post_status_updates' THEN
            RETURN user_role IN ('owner', 'admin', 'responder');
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION check_user_permission(UUID, UUID, TEXT) IS 
'Check if user has specific permission in organization based on their role';

-- Update existing members to have appropriate roles
-- Convert existing 'member' roles to 'responder' for backwards compatibility
UPDATE public.organization_members 
SET role = 'responder' 
WHERE role = 'member';

-- Verify the changes
SELECT 'User role system updated successfully' as result; 