-- Schema Update 12: Add Default Organization Support
-- Add is_default field to organization_members table to track user's default organization

-- Add is_default column to organization_members table
ALTER TABLE public.organization_members 
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Add index for efficient querying of default organizations
CREATE INDEX idx_organization_members_is_default ON public.organization_members(user_id, is_default) WHERE is_default = true;

-- Add constraint to ensure a user can only have one default organization
CREATE UNIQUE INDEX idx_organization_members_one_default_per_user 
ON public.organization_members(user_id) 
WHERE is_default = true;

-- Function to set an organization as default for a user
-- This ensures only one organization can be default per user
CREATE OR REPLACE FUNCTION public.set_default_organization(p_user_id UUID, p_organization_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- First, remove default status from all user's organizations
    UPDATE public.organization_members 
    SET is_default = false, updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Then set the specified organization as default
    UPDATE public.organization_members 
    SET is_default = true, updated_at = NOW()
    WHERE user_id = p_user_id AND organization_id = p_organization_id;
    
    -- Return true if the update was successful
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's default organization
CREATE OR REPLACE FUNCTION public.get_default_organization(p_user_id UUID)
RETURNS TABLE(
    organization_id UUID,
    organization_name VARCHAR,
    role VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as organization_id,
        o.name as organization_name,
        om.role
    FROM public.organization_members om
    JOIN public.organizations o ON om.organization_id = o.id
    WHERE om.user_id = p_user_id 
    AND om.is_default = true 
    AND om.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN public.organization_members.is_default IS 'Whether this organization is the user''s default organization';
COMMENT ON FUNCTION public.set_default_organization(UUID, UUID) IS 'Set an organization as default for a user, ensuring only one default per user';
COMMENT ON FUNCTION public.get_default_organization(UUID) IS 'Get user''s default organization if set';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.set_default_organization(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_organization(UUID) TO authenticated;

-- Verification queries
SELECT 'Schema update 12 applied successfully' as status; 