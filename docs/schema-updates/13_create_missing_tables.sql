-- Create missing tables for Alert24 app
-- These tables are referenced in the code but don't exist in the database

-- Service Status History Table
-- Tracks historical status changes for services (needed for timeline data on status pages)
CREATE TABLE IF NOT EXISTS public.service_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'operational',
    status_message TEXT,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_status_history_service_id ON public.service_status_history(service_id);
CREATE INDEX IF NOT EXISTS idx_service_status_history_checked_at ON public.service_status_history(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_status_history_service_status ON public.service_status_history(service_id, status);

-- Add is_active column to on_call_schedules if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Add organization_id to services table if it doesn't exist (for direct organization linking)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.services ADD COLUMN organization_id UUID;
        -- Add foreign key constraint
        ALTER TABLE public.services ADD CONSTRAINT fk_services_organization 
            FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
        -- Add index
        CREATE INDEX idx_services_organization_id ON public.services(organization_id);
    END IF;
END $$;

-- Check Results Table (for monitoring check execution results)
CREATE TABLE IF NOT EXISTS public.check_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitoring_check_id UUID NOT NULL, -- References monitoring check (stored as service)
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    check_data JSONB,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for check results
CREATE INDEX IF NOT EXISTS idx_check_results_monitoring_check_id ON public.check_results(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_check_results_checked_at ON public.check_results(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_status ON public.check_results(status);

-- Monitoring Locations Table (referenced in code but missing)
CREATE TABLE IF NOT EXISTS public.monitoring_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    country_code VARCHAR(2),
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT true NOT NULL,
    endpoint_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add default monitoring locations
INSERT INTO public.monitoring_locations (id, name, region, country_code, city, is_active, endpoint_url) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'US East (Virginia)', 'us-east-1', 'US', 'Virginia', true, 'https://monitoring-us-east.alert24.app'),
    ('00000000-0000-0000-0000-000000000002', 'US West (California)', 'us-west-1', 'US', 'California', true, 'https://monitoring-us-west.alert24.app'),
    ('00000000-0000-0000-0000-000000000003', 'Europe (Ireland)', 'eu-west-1', 'IE', 'Dublin', true, 'https://monitoring-eu.alert24.app'),
    ('00000000-0000-0000-0000-000000000004', 'Asia Pacific (Singapore)', 'ap-southeast-1', 'SG', 'Singapore', true, 'https://monitoring-ap.alert24.app')
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for new tables
ALTER TABLE public.service_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policy for service_status_history (users can access history for services in their organizations)
CREATE POLICY "Users can view service status history for their organizations" ON public.service_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.services s
            JOIN public.status_pages sp ON s.status_page_id = sp.id
            JOIN public.organization_members om ON sp.organization_id = om.organization_id
            WHERE s.id = service_status_history.service_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
    );

-- RLS Policy for check_results (users can access results for their organization's monitoring checks)
CREATE POLICY "Users can view check results for their organizations" ON public.check_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.services s
            JOIN public.status_pages sp ON s.status_page_id = sp.id
            JOIN public.organization_members om ON sp.organization_id = om.organization_id
            WHERE s.id = check_results.service_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
    );

-- RLS Policy for monitoring_locations (public read access for active locations)
CREATE POLICY "Anyone can view active monitoring locations" ON public.monitoring_locations
    FOR SELECT USING (is_active = true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.service_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.check_results TO authenticated;
GRANT SELECT ON public.monitoring_locations TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.service_status_history IS 'Historical status data for services, used for uptime timelines';
COMMENT ON TABLE public.check_results IS 'Results from monitoring check executions';
COMMENT ON TABLE public.monitoring_locations IS 'Geographic locations for distributed monitoring';

-- Update updated_at trigger for new tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_status_history_updated_at 
    BEFORE UPDATE ON public.service_status_history 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monitoring_locations_updated_at 
    BEFORE UPDATE ON public.monitoring_locations 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); 