-- Create missing tables for Alert24 app - SAFE VERSION
-- These tables are referenced in the code but don't exist in the database

-- Step 1: Handle Service Status History Table safely
DO $$ 
BEGIN
    -- Check if service_status_history table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'service_status_history'
    ) THEN
        -- Create the table if it doesn't exist
        CREATE TABLE public.service_status_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
            status VARCHAR(50) NOT NULL DEFAULT 'operational',
            status_message TEXT,
            response_time_ms INTEGER,
            error_message TEXT,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add indexes for performance  
        CREATE INDEX idx_service_status_history_service_id ON public.service_status_history(service_id);
        CREATE INDEX idx_service_status_history_started_at ON public.service_status_history(started_at DESC);
        CREATE INDEX idx_service_status_history_service_status ON public.service_status_history(service_id, status);
        
        RAISE NOTICE 'Created service_status_history table with started_at column';
    ELSE
        -- Table exists, check if it has the correct columns
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'service_status_history' 
            AND column_name = 'started_at'
        ) THEN
            -- Add the started_at column if missing
            ALTER TABLE public.service_status_history ADD COLUMN started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
            RAISE NOTICE 'Added started_at column to existing service_status_history table';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'service_status_history' 
            AND column_name = 'ended_at'
        ) THEN
            -- Add the ended_at column if missing
            ALTER TABLE public.service_status_history ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE 'Added ended_at column to existing service_status_history table';
        END IF;
        
        -- Ensure indexes exist
        CREATE INDEX IF NOT EXISTS idx_service_status_history_service_id ON public.service_status_history(service_id);
        CREATE INDEX IF NOT EXISTS idx_service_status_history_started_at ON public.service_status_history(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_service_status_history_service_status ON public.service_status_history(service_id, status);
        
        RAISE NOTICE 'Updated existing service_status_history table schema';
    END IF;
END $$;

-- Step 2: Add is_active column to on_call_schedules if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
        RAISE NOTICE 'Added is_active column to on_call_schedules table';
    END IF;
END $$;

-- Step 3: Add organization_id to services table if it doesn't exist
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
        RAISE NOTICE 'Added organization_id column to services table';
    END IF;
END $$;

-- Step 4: Create Check Results Table
CREATE TABLE IF NOT EXISTS public.check_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitoring_check_id UUID, -- Will be updated later to reference monitoring_checks table
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

-- Step 5: Create Monitoring Locations Table
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

-- Add default monitoring locations (ignore conflicts)
INSERT INTO public.monitoring_locations (id, name, region, country_code, city, is_active, endpoint_url) 
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'US East (Virginia)', 'us-east-1', 'US', 'Virginia', true, 'https://monitoring-us-east.alert24.app'),
    ('00000000-0000-0000-0000-000000000002', 'US West (California)', 'us-west-1', 'US', 'California', true, 'https://monitoring-us-west.alert24.app'),
    ('00000000-0000-0000-0000-000000000003', 'Europe (Ireland)', 'eu-west-1', 'IE', 'Dublin', true, 'https://monitoring-eu.alert24.app'),
    ('00000000-0000-0000-0000-000000000004', 'Asia Pacific (Singapore)', 'ap-southeast-1', 'SG', 'Singapore', true, 'https://monitoring-ap.alert24.app')
ON CONFLICT (id) DO NOTHING;

-- Step 6: Enable RLS (only if tables were created)
DO $$ 
BEGIN
    -- Enable RLS for service_status_history
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_status_history') THEN
        ALTER TABLE public.service_status_history ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Enable RLS for check_results
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_results') THEN
        ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Enable RLS for monitoring_locations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monitoring_locations') THEN
        ALTER TABLE public.monitoring_locations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 7: Create RLS Policies (with conflict handling)
DO $$ 
BEGIN
    -- Service status history policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'service_status_history' 
        AND policyname = 'Users can view service status history for their organizations'
    ) THEN
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
    END IF;
    
    -- Check results policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'check_results' 
        AND policyname = 'Users can view check results for their organizations'
    ) THEN
        CREATE POLICY "Users can view check results for their organizations" ON public.check_results
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.services monitoring_service
                    JOIN public.status_pages sp ON monitoring_service.status_page_id = sp.id
                    JOIN public.organization_members om ON sp.organization_id = om.organization_id
                    WHERE monitoring_service.id = check_results.monitoring_check_id
                    AND om.user_id = auth.uid()
                    AND om.is_active = true
                )
            );
    END IF;
    
    -- Monitoring locations policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'monitoring_locations' 
        AND policyname = 'Anyone can view active monitoring locations'
    ) THEN
        CREATE POLICY "Anyone can view active monitoring locations" ON public.monitoring_locations
            FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Step 8: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.service_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.check_results TO authenticated;
GRANT SELECT ON public.monitoring_locations TO authenticated;

-- Step 9: Add INSERT policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'check_results' 
        AND policyname = 'Authenticated users can insert check results'
    ) THEN
        CREATE POLICY "Authenticated users can insert check results" ON public.check_results
            FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'service_status_history' 
        AND policyname = 'Authenticated users can insert service status history'
    ) THEN
        CREATE POLICY "Authenticated users can insert service status history" ON public.service_status_history
            FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Step 10: Create update trigger function and triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND trigger_name = 'update_service_status_history_updated_at'
    ) THEN
        CREATE TRIGGER update_service_status_history_updated_at 
            BEFORE UPDATE ON public.service_status_history 
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND trigger_name = 'update_monitoring_locations_updated_at'
    ) THEN
        CREATE TRIGGER update_monitoring_locations_updated_at 
            BEFORE UPDATE ON public.monitoring_locations 
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Add table comments
COMMENT ON TABLE public.service_status_history IS 'Historical status data for services, used for uptime timelines';
COMMENT ON TABLE public.check_results IS 'Results from monitoring check executions';
COMMENT ON TABLE public.monitoring_locations IS 'Geographic locations for distributed monitoring';

-- Print completion message
DO $$ 
BEGIN
    RAISE NOTICE 'Migration 13 completed successfully - all missing tables and columns have been created/updated';
END $$; 