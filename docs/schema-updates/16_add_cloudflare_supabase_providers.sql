-- Add support for Cloudflare and Supabase providers to status page checks
-- This updates the validation function to include the new providers
--
-- IMPORTANT: This script should be run via Supabase dashboard or migrations
-- Do not run directly with psql - use Supabase SQL editor or migrations

-- Step 1: Update the validation function to include cloudflare and supabase
CREATE OR REPLACE FUNCTION validate_status_page_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if required fields are present
    IF config IS NULL OR 
       config->>'provider' IS NULL OR 
       config->>'service' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider is valid (now includes cloudflare and supabase)
    IF config->>'provider' NOT IN ('azure', 'aws', 'gcp', 'cloudflare', 'supabase') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if regions is an array (optional)
    IF config->'regions' IS NOT NULL AND 
       jsonb_typeof(config->'regions') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Check if failure_behavior is valid (optional)
    IF config->>'failure_behavior' IS NOT NULL AND 
       config->>'failure_behavior' NOT IN ('match_status', 'always_degraded', 'always_down') THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 2: The constraint will automatically use the updated function
-- No need to recreate the constraint, it references the function

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Successfully updated status page validation to include Cloudflare and Supabase providers';
    RAISE NOTICE 'Status page checks can now use providers: azure, aws, gcp, cloudflare, supabase';
END $$;