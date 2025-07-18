-- Check the actual schema of on_call_schedules table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'on_call_schedules';

-- Check existing policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    roles 
FROM pg_policies 
WHERE tablename = 'on_call_schedules';

-- Check grants
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules';