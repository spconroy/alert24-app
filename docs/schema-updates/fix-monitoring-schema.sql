-- Fix Monitoring Schema Issues
-- This script resolves the database schema issues causing monitoring checks to show "unknown" status

BEGIN;

-- Step 1: Fix service_status_history table
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

-- Step 2: Ensure monitoring_checks table exists with proper schema
CREATE TABLE IF NOT EXISTS public.monitoring_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    check_type VARCHAR(50) NOT NULL DEFAULT 'http',
    target_url TEXT,
    method VARCHAR(10) DEFAULT 'GET',
    headers JSONB DEFAULT '{}',
    body TEXT,
    expected_status_code INTEGER DEFAULT 200,
    timeout_seconds INTEGER DEFAULT 30,
    check_interval_seconds INTEGER DEFAULT 300, -- 5 minutes
    failure_threshold INTEGER DEFAULT 3,
    success_threshold INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, disabled
    current_status VARCHAR(50) DEFAULT 'unknown', -- up, down, unknown
    last_check_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    consecutive_successes INTEGER DEFAULT 0,
    linked_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    failure_threshold_minutes INTEGER DEFAULT 5,
    failure_message TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for monitoring_checks performance
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_organization_id ON public.monitoring_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status ON public.monitoring_checks(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_current_status ON public.monitoring_checks(current_status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_linked_service ON public.monitoring_checks(linked_service_id);

-- Step 3: Ensure check_results table exists
CREATE TABLE IF NOT EXISTS public.check_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    monitoring_check_id UUID NOT NULL REFERENCES public.monitoring_checks(id) ON DELETE CASCADE,
    is_successful BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    response_body TEXT,
    response_headers JSONB,
    error_message TEXT,
    ssl_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for check_results performance
CREATE INDEX IF NOT EXISTS idx_check_results_monitoring_check_id ON public.check_results(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_check_results_created_at ON public.check_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_is_successful ON public.check_results(monitoring_check_id, is_successful);

-- Step 4: Fix incidents table foreign key relationship to services
DO $$
BEGIN
    -- Check if foreign key constraint exists from incidents to services
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
        AND tc.table_name = 'incidents'
        AND kcu.column_name = 'service_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Add service_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'incidents' 
            AND column_name = 'service_id'
        ) THEN
            ALTER TABLE public.incidents ADD COLUMN service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added service_id column to incidents table';
        ELSE
            -- Add foreign key constraint if column exists but constraint doesn't
            ALTER TABLE public.incidents ADD CONSTRAINT fk_incidents_service_id 
                FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added foreign key constraint for incidents.service_id';
        END IF;
    END IF;
END $$;

-- Step 5: Update monitoring checks to have proper current_status
UPDATE public.monitoring_checks 
SET current_status = 'unknown' 
WHERE current_status IS NULL;

-- Step 6: Fix on_call_schedules table schema (add missing columns)
DO $$
BEGIN
    -- Check if members column exists, add if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'members'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN members JSONB NOT NULL DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added members column to on_call_schedules table';
    END IF;
    
    -- Check if overrides column exists, add if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'overrides'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN overrides JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added overrides column to on_call_schedules table';
    END IF;
    
    -- Check if schedule_type column exists, add if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'schedule_type'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN schedule_type VARCHAR(50) NOT NULL DEFAULT 'rotation';
        RAISE NOTICE 'Added schedule_type column to on_call_schedules table';
    END IF;
END $$;

-- Step 7: Enable RLS policies (if not already enabled)
DO $$
BEGIN
    -- Enable RLS for monitoring_checks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monitoring_checks') THEN
        ALTER TABLE public.monitoring_checks ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for monitoring_checks
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitoring_checks' AND policyname = 'Users can view monitoring checks for their organizations') THEN
            CREATE POLICY "Users can view monitoring checks for their organizations" ON public.monitoring_checks
                FOR ALL USING (
                    organization_id IN (
                        SELECT om.organization_id 
                        FROM public.organization_members om 
                        WHERE om.user_id = auth.uid()
                        AND om.is_active = true
                    )
                );
        END IF;
    END IF;
    
    -- Enable RLS for check_results  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_results') THEN
        ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for check_results
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'check_results' AND policyname = 'Users can view check results for their organizations') THEN
            CREATE POLICY "Users can view check results for their organizations" ON public.check_results
                FOR ALL USING (
                    monitoring_check_id IN (
                        SELECT mc.id 
                        FROM public.monitoring_checks mc
                        JOIN public.organization_members om ON mc.organization_id = om.organization_id
                        WHERE om.user_id = auth.uid()
                        AND om.is_active = true
                    )
                );
        END IF;
    END IF;
    
    -- Enable RLS for on_call_schedules
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'on_call_schedules') THEN
        ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for on_call_schedules
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'on_call_schedules' AND policyname = 'Users can view on-call schedules for their organizations') THEN
            CREATE POLICY "Users can view on-call schedules for their organizations" ON public.on_call_schedules
                FOR SELECT USING (
                    organization_id IN (
                        SELECT om.organization_id 
                        FROM public.organization_members om 
                        WHERE om.user_id = auth.uid() 
                        AND om.is_active = true
                    )
                );
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'on_call_schedules' AND policyname = 'Users can insert on-call schedules for their organizations') THEN
            CREATE POLICY "Users can insert on-call schedules for their organizations" ON public.on_call_schedules
                FOR INSERT WITH CHECK (
                    organization_id IN (
                        SELECT om.organization_id 
                        FROM public.organization_members om 
                        WHERE om.user_id = auth.uid() 
                        AND om.is_active = true
                        AND om.role IN ('owner', 'admin')
                    )
                );
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'on_call_schedules' AND policyname = 'Users can update on-call schedules for their organizations') THEN
            CREATE POLICY "Users can update on-call schedules for their organizations" ON public.on_call_schedules
                FOR UPDATE USING (
                    organization_id IN (
                        SELECT om.organization_id 
                        FROM public.organization_members om 
                        WHERE om.user_id = auth.uid() 
                        AND om.is_active = true
                        AND om.role IN ('owner', 'admin')
                    )
                );
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'on_call_schedules' AND policyname = 'Users can delete on-call schedules for their organizations') THEN
            CREATE POLICY "Users can delete on-call schedules for their organizations" ON public.on_call_schedules
                FOR DELETE USING (
                    organization_id IN (
                        SELECT om.organization_id 
                        FROM public.organization_members om 
                        WHERE om.user_id = auth.uid() 
                        AND om.is_active = true
                        AND om.role IN ('owner', 'admin')
                    )
                );
        END IF;
    END IF;
END $$;

-- Step 8: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.on_call_schedules TO authenticated;

-- Step 9: Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to monitoring_checks table
DROP TRIGGER IF EXISTS update_monitoring_checks_updated_at ON public.monitoring_checks;
CREATE TRIGGER update_monitoring_checks_updated_at
    BEFORE UPDATE ON public.monitoring_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply the trigger to service_status_history table
DROP TRIGGER IF EXISTS update_service_status_history_updated_at ON public.service_status_history;
CREATE TRIGGER update_service_status_history_updated_at
    BEFORE UPDATE ON public.service_status_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Final notification
SELECT 'Monitoring schema fix completed successfully!' as status; 