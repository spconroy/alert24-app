-- Add created_by column to on_call_schedules table
ALTER TABLE on_call_schedules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Verify it was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
AND column_name = 'created_by';