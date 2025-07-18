-- Add status page check type support to monitoring_checks table
-- This adds the ability to monitor cloud provider status pages

-- Step 1: Add status_page_config column to monitoring_checks table
ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS status_page_config JSONB;

-- Step 2: Update the check_type constraint to include status_page
ALTER TABLE public.monitoring_checks 
DROP CONSTRAINT IF EXISTS monitoring_checks_check_type_check;

ALTER TABLE public.monitoring_checks 
ADD CONSTRAINT monitoring_checks_check_type_check 
CHECK (check_type IN ('http', 'ping', 'tcp', 'dns', 'ssl', 'keyword', 'status_page'));

-- Step 3: Create index for status page configurations
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status_page_config 
ON public.monitoring_checks USING gin (status_page_config);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN public.monitoring_checks.status_page_config IS 'Configuration for status page monitoring: {provider, service, regions, api_url}';

-- Step 5: Create view for status page checks
CREATE OR REPLACE VIEW public.status_page_checks AS
SELECT 
    mc.id,
    mc.name,
    mc.organization_id,
    mc.status_page_config,
    mc.status,
    mc.current_status,
    mc.last_check_at,
    mc.last_success_at,
    mc.last_failure_at,
    mc.consecutive_failures,
    mc.consecutive_successes,
    mc.linked_service_id,
    mc.failure_threshold_minutes,
    mc.failure_message,
    mc.created_at,
    mc.updated_at,
    s.name as linked_service_name,
    sp.name as status_page_name,
    o.name as organization_name
FROM public.monitoring_checks mc
LEFT JOIN public.services s ON mc.linked_service_id = s.id
LEFT JOIN public.status_pages sp ON s.status_page_id = sp.id
LEFT JOIN public.organizations o ON mc.organization_id = o.id
WHERE mc.check_type = 'status_page'
AND mc.deleted_at IS NULL;

-- Grant view permissions
GRANT SELECT ON public.status_page_checks TO authenticated;

-- Step 6: Add validation function for status page config
CREATE OR REPLACE FUNCTION validate_status_page_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if required fields are present
    IF config IS NULL OR 
       config->>'provider' IS NULL OR 
       config->>'service' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider is valid
    IF config->>'provider' NOT IN ('azure', 'aws', 'gcp') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if regions is an array (optional)
    IF config->'regions' IS NOT NULL AND 
       jsonb_typeof(config->'regions') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Add constraint to validate status page config
ALTER TABLE public.monitoring_checks 
ADD CONSTRAINT monitoring_checks_valid_status_page_config 
CHECK (
    check_type != 'status_page' OR 
    validate_status_page_config(status_page_config)
);

-- Step 8: Create function to get status page check summary
CREATE OR REPLACE FUNCTION get_status_page_check_summary(org_id UUID)
RETURNS TABLE (
    provider TEXT,
    service_count BIGINT,
    up_count BIGINT,
    down_count BIGINT,
    degraded_count BIGINT,
    unknown_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (mc.status_page_config->>'provider')::TEXT as provider,
        COUNT(*)::BIGINT as service_count,
        COUNT(CASE WHEN mc.current_status = 'up' THEN 1 END)::BIGINT as up_count,
        COUNT(CASE WHEN mc.current_status = 'down' THEN 1 END)::BIGINT as down_count,
        COUNT(CASE WHEN mc.current_status = 'degraded' THEN 1 END)::BIGINT as degraded_count,
        COUNT(CASE WHEN mc.current_status = 'unknown' THEN 1 END)::BIGINT as unknown_count
    FROM public.monitoring_checks mc
    WHERE mc.organization_id = org_id
    AND mc.check_type = 'status_page'
    AND mc.deleted_at IS NULL
    GROUP BY (mc.status_page_config->>'provider');
END;
$$ LANGUAGE plpgsql;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_status_page_check_summary(UUID) TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Successfully added status page check support to monitoring_checks table';
    RAISE NOTICE 'New check_type "status_page" is now available';
    RAISE NOTICE 'status_page_config column added for provider configuration';
END $$;