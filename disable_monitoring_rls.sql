-- Disable RLS for monitoring_checks table
-- This removes the auth.uid() dependency and allows NextAuth users to create monitors
-- Security is handled at the application level through organization membership validation

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view monitoring checks for their organizations" ON public.monitoring_checks;
DROP POLICY IF EXISTS "Users can insert monitoring checks for their organizations" ON public.monitoring_checks;
DROP POLICY IF EXISTS "Users can update monitoring checks for their organizations" ON public.monitoring_checks;
DROP POLICY IF EXISTS "Users can delete monitoring checks for their organizations" ON public.monitoring_checks;

-- Also drop the older policy if it exists
DROP POLICY IF EXISTS "monitoring_checks_organization_isolation" ON public.monitoring_checks;

-- Disable RLS on the table
ALTER TABLE public.monitoring_checks DISABLE ROW LEVEL SECURITY;

-- Ensure permissions are still granted to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_checks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_checks TO anon;

-- Optional: Add a simple policy that allows all authenticated users if you want basic protection
-- (uncomment these lines if you want some basic RLS without auth.uid() dependency)
-- ALTER TABLE public.monitoring_checks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for authenticated users" ON public.monitoring_checks FOR ALL TO authenticated USING (true);

COMMENT ON TABLE public.monitoring_checks IS 'RLS disabled - security handled at application level via NextAuth and organization membership validation';