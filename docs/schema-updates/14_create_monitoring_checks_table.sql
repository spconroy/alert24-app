-- Create proper monitoring_checks table and migrate data
-- This resolves the issue of monitoring checks appearing on status pages

-- Step 1: Create the monitoring_checks table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_organization_id ON public.monitoring_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status ON public.monitoring_checks(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_current_status ON public.monitoring_checks(current_status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_linked_service ON public.monitoring_checks(linked_service_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_last_check ON public.monitoring_checks(last_check_at DESC);

-- Step 2: Migrate existing monitoring data from services table
INSERT INTO public.monitoring_checks (
    id,
    organization_id,
    name,
    description,
    check_type,
    target_url,
    method,
    timeout_seconds,
    check_interval_seconds,
    status,
    linked_service_id,
    failure_threshold_minutes,
    failure_message,
    created_at,
    updated_at
)
SELECT 
    s.id,
    sp.organization_id,
    -- Remove [MONITORING] prefix from name
    CASE 
        WHEN s.name LIKE '[MONITORING]%' THEN TRIM(SUBSTRING(s.name FROM 13))
        ELSE s.name
    END,
    -- Extract data from JSON description or use as text
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'description'), 'Migrated monitoring check')
        ELSE
            COALESCE(s.description, 'Migrated monitoring check')
    END,
    -- Extract check type from JSON or default to http
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'check_type'), 'http')
        ELSE 'http'
    END,
    -- Extract target URL from JSON or set to null
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            (s.description::jsonb ->> 'target_url')
        ELSE NULL
    END,
    -- Extract method from JSON or default to GET
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'method'), 'GET')
        ELSE 'GET'
    END,
    -- Extract timeout from JSON or default to 30
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'timeout_seconds')::integer, 30)
        ELSE 30
    END,
    -- Extract interval from JSON or default to 300
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'check_interval_seconds')::integer, 300)
        ELSE 300
    END,
    -- Set status based on service status
    CASE 
        WHEN s.status = 'down' THEN 'disabled'
        WHEN s.status = 'maintenance' THEN 'paused'
        ELSE 'active'
    END,
    -- Extract linked service ID from JSON
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            (s.description::jsonb ->> 'linked_service_id')::uuid
        ELSE NULL
    END,
    -- Extract failure threshold minutes from JSON or default to 5
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            COALESCE((s.description::jsonb ->> 'failure_threshold_minutes')::integer, 5)
        ELSE 5
    END,
    -- Extract failure message from JSON
    CASE 
        WHEN s.description ~ '^{.*}$' THEN
            (s.description::jsonb ->> 'failure_message')
        ELSE NULL
    END,
    s.created_at,
    s.updated_at
FROM public.services s
JOIN public.status_pages sp ON s.status_page_id = sp.id
WHERE s.name LIKE '[MONITORING]%'
AND s.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Update existing check_results table to reference monitoring_checks
-- (if the table exists from previous migration)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'check_results') THEN
        -- Update foreign key constraint to point to monitoring_checks instead of services
        ALTER TABLE public.check_results 
            DROP CONSTRAINT IF EXISTS check_results_monitoring_check_id_fkey;
        
        ALTER TABLE public.check_results 
            ADD CONSTRAINT check_results_monitoring_check_id_fkey 
            FOREIGN KEY (monitoring_check_id) REFERENCES public.monitoring_checks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Remove monitoring checks from services table
DELETE FROM public.services 
WHERE name LIKE '[MONITORING]%'
AND deleted_at IS NULL;

-- Step 5: Enable RLS for monitoring_checks
ALTER TABLE public.monitoring_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view monitoring checks for their organizations
CREATE POLICY "Users can view monitoring checks for their organizations" ON public.monitoring_checks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = monitoring_checks.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
    );

-- RLS Policy: Users can insert monitoring checks for their organizations
CREATE POLICY "Users can insert monitoring checks for their organizations" ON public.monitoring_checks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = monitoring_checks.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin', 'responder')
        )
    );

-- RLS Policy: Users can update monitoring checks for their organizations
CREATE POLICY "Users can update monitoring checks for their organizations" ON public.monitoring_checks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = monitoring_checks.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin', 'responder')
        )
    );

-- RLS Policy: Users can delete monitoring checks for their organizations (owners/admins only)
CREATE POLICY "Users can delete monitoring checks for their organizations" ON public.monitoring_checks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = monitoring_checks.organization_id
            AND om.user_id = auth.uid()
            AND om.is_active = true
            AND om.role IN ('owner', 'admin')
        )
    );

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_checks TO authenticated;

-- Step 7: Add triggers for updated_at
CREATE TRIGGER update_monitoring_checks_updated_at 
    BEFORE UPDATE ON public.monitoring_checks 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Add comments for documentation
COMMENT ON TABLE public.monitoring_checks IS 'Monitoring checks for service uptime and health monitoring';
COMMENT ON COLUMN public.monitoring_checks.check_type IS 'Type of check: http, ping, tcp, dns, etc.';
COMMENT ON COLUMN public.monitoring_checks.current_status IS 'Current status: up, down, unknown';
COMMENT ON COLUMN public.monitoring_checks.linked_service_id IS 'Optional service to link this monitoring check to for status updates';

-- Step 9: Create view for backward compatibility (optional)
CREATE OR REPLACE VIEW public.monitoring_checks_summary AS
SELECT 
    mc.id,
    mc.name,
    mc.organization_id,
    mc.check_type,
    mc.target_url,
    mc.status as check_status,
    mc.current_status,
    mc.last_check_at,
    mc.consecutive_failures,
    mc.linked_service_id,
    s.name as linked_service_name,
    o.name as organization_name
FROM public.monitoring_checks mc
LEFT JOIN public.services s ON mc.linked_service_id = s.id
LEFT JOIN public.organizations o ON mc.organization_id = o.id
WHERE mc.deleted_at IS NULL;

-- Grant view permissions
GRANT SELECT ON public.monitoring_checks_summary TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Successfully created monitoring_checks table and migrated data from services table';
    RAISE NOTICE 'Monitoring checks are now separated from services and will not appear on status pages';
END $$; 