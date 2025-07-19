-- Fix status page provider validation function
-- Run this in your Supabase SQL Editor to enable all 21 status page providers
-- 
-- This fixes the "Failed to create monitoring check" error for new providers like Stripe

CREATE OR REPLACE FUNCTION validate_status_page_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if required fields are present
    IF config IS NULL OR 
       config->>'provider' IS NULL OR 
       config->>'service' IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider is valid - updated with all implemented providers
    IF config->>'provider' NOT IN (
        'azure', 'aws', 'gcp', 'cloudflare', 'supabase',
        'github', 'stripe', 'netlify', 'vercel', 'digitalocean', 
        'sendgrid', 'slack', 'twilio', 'paypal', 'shopify', 
        'zoom', 'zendesk', 'heroku', 'discord', 'fastly', 'openai'
    ) THEN
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

-- Update function comment
COMMENT ON FUNCTION validate_status_page_config(JSONB) IS 
'Validates status page configuration. Supports 21 providers: azure, aws, gcp, cloudflare, supabase, github, stripe, netlify, vercel, digitalocean, sendgrid, slack, twilio, paypal, shopify, zoom, zendesk, heroku, discord, fastly, openai';

-- Success message
SELECT 'Status page provider validation function updated successfully! All 21 providers are now supported.' as result;