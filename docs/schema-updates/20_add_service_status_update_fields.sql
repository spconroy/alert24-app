-- Add service status update fields to monitoring_checks table
-- This allows monitoring checks to automatically update linked service status when they fail/recover

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS update_service_status BOOLEAN DEFAULT false;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS service_failure_status VARCHAR(20) DEFAULT 'down';

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS service_recovery_status VARCHAR(20) DEFAULT 'operational';

-- Add check constraints to ensure valid service status values
ALTER TABLE public.monitoring_checks 
ADD CONSTRAINT check_service_failure_status 
CHECK (service_failure_status IN ('operational', 'degraded', 'down', 'maintenance'));

ALTER TABLE public.monitoring_checks 
ADD CONSTRAINT check_service_recovery_status 
CHECK (service_recovery_status IN ('operational', 'degraded', 'down', 'maintenance'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_update_service_status ON public.monitoring_checks(update_service_status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_linked_service_update ON public.monitoring_checks(linked_service_id, update_service_status);

-- Add comments for documentation
COMMENT ON COLUMN public.monitoring_checks.update_service_status IS 'Whether to automatically update linked service status when check fails/recovers';
COMMENT ON COLUMN public.monitoring_checks.service_failure_status IS 'Service status to set when check fails: operational, degraded, down, maintenance';
COMMENT ON COLUMN public.monitoring_checks.service_recovery_status IS 'Service status to set when check recovers: operational, degraded, down, maintenance';

-- Success message
SELECT 'Successfully added service status update fields to monitoring_checks table' as result;