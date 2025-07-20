-- Add incident creation fields to monitoring_checks table
-- This allows monitoring checks to automatically create incidents when failures occur

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS auto_create_incidents BOOLEAN DEFAULT false;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS incident_severity VARCHAR(20) DEFAULT 'medium';

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS incident_threshold_minutes INTEGER DEFAULT 5;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS incident_title_template TEXT;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS incident_description_template TEXT;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS auto_resolve_incidents BOOLEAN DEFAULT true;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS assigned_on_call_schedule_id UUID REFERENCES public.on_call_schedules(id) ON DELETE SET NULL;

ALTER TABLE public.monitoring_checks 
ADD COLUMN IF NOT EXISTS assigned_escalation_policy_id UUID REFERENCES public.escalation_policies(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_auto_create_incidents ON public.monitoring_checks(auto_create_incidents);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_on_call_schedule ON public.monitoring_checks(assigned_on_call_schedule_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_escalation_policy ON public.monitoring_checks(assigned_escalation_policy_id);

-- Add comments for documentation
COMMENT ON COLUMN public.monitoring_checks.auto_create_incidents IS 'Whether to automatically create incidents when check fails';
COMMENT ON COLUMN public.monitoring_checks.incident_severity IS 'Severity level for auto-created incidents: low, medium, high, critical';
COMMENT ON COLUMN public.monitoring_checks.incident_threshold_minutes IS 'Minutes of failure before creating incident';
COMMENT ON COLUMN public.monitoring_checks.incident_title_template IS 'Template for incident title with placeholders';
COMMENT ON COLUMN public.monitoring_checks.incident_description_template IS 'Template for incident description with placeholders';
COMMENT ON COLUMN public.monitoring_checks.auto_resolve_incidents IS 'Whether to automatically resolve incidents when check recovers';
COMMENT ON COLUMN public.monitoring_checks.assigned_on_call_schedule_id IS 'On-call schedule to assign to auto-created incidents';
COMMENT ON COLUMN public.monitoring_checks.assigned_escalation_policy_id IS 'Escalation policy to apply to auto-created incidents';

-- Success message
SELECT 'Successfully added incident creation fields to monitoring_checks table' as result;