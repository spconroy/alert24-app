-- Disable Row Level Security for escalation_policies table
-- This follows the pattern mentioned in the table comments - RLS is handled in application layer

-- Disable RLS on the table
ALTER TABLE escalation_policies DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies
DROP POLICY IF EXISTS escalation_policies_organization_access ON escalation_policies;
DROP POLICY IF EXISTS escalation_policies_organization_isolation ON escalation_policies;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'escalation_policies' AND schemaname = 'public';