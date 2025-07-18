-- Simple check of on_call_schedules table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
ORDER BY ordinal_position;