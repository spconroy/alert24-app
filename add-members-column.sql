-- Add members column to on_call_schedules table
ALTER TABLE on_call_schedules ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
AND column_name = 'members';