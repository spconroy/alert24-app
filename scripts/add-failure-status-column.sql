-- Add failure_status column to service_monitoring_checks table
-- This allows users to configure whether a failed check marks the service as 'degraded' or 'down'

DO $$
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'service_monitoring_checks' 
        AND column_name = 'failure_status'
    ) THEN
        -- Add the failure_status column
        ALTER TABLE public.service_monitoring_checks 
        ADD COLUMN failure_status VARCHAR(20) NOT NULL DEFAULT 'degraded' 
        CHECK (failure_status IN ('degraded', 'down', 'maintenance'));
        
        RAISE NOTICE 'Added failure_status column to service_monitoring_checks table';
    ELSE
        RAISE NOTICE 'failure_status column already exists in service_monitoring_checks table';
    END IF;
END $$;

-- Add a comment to explain the column
COMMENT ON COLUMN public.service_monitoring_checks.failure_status IS 
'Service status to set when this monitoring check fails: degraded, down, or maintenance';

-- Update existing records to have 'degraded' as the default (less severe than 'down')
UPDATE public.service_monitoring_checks 
SET failure_status = 'degraded' 
WHERE failure_status IS NULL OR failure_status = '';

-- Verify the change
SELECT 'failure_status column successfully configured for service_monitoring_checks table' as result; 