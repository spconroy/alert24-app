-- Add failure status configuration for monitoring checks
-- This controls what service status gets set when the monitoring check fails

ALTER TABLE public.service_monitoring_checks 
ADD COLUMN failure_status VARCHAR(20) NOT NULL DEFAULT 'down' CHECK (failure_status IN ('degraded', 'down', 'maintenance'));

-- Add a comment to explain the column
COMMENT ON COLUMN public.service_monitoring_checks.failure_status IS 
'Service status to set when this monitoring check fails: degraded, down, or maintenance';

-- Update existing records to have 'down' as the default failure status
UPDATE public.service_monitoring_checks SET failure_status = 'down' WHERE failure_status IS NULL;

-- Verify the change
SELECT 'failure_status column added to service_monitoring_checks table' as result; 