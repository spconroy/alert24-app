-- Simple fix for on-call schedules schema issues
-- This script adds missing columns and disables RLS for NextAuth compatibility

BEGIN;

-- Step 1: Add missing columns to on_call_schedules table
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
    ELSE
        RAISE NOTICE 'members column already exists in on_call_schedules table';
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
    ELSE
        RAISE NOTICE 'overrides column already exists in on_call_schedules table';
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
    ELSE
        RAISE NOTICE 'schedule_type column already exists in on_call_schedules table';
    END IF;
END $$;

-- Step 2: Disable RLS on on_call_schedules (NextAuth compatibility)
ALTER TABLE public.on_call_schedules DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing RLS policies for on_call_schedules
DROP POLICY IF EXISTS "Users can view on-call schedules for their organizations" ON public.on_call_schedules;
DROP POLICY IF EXISTS "Users can insert on-call schedules for their organizations" ON public.on_call_schedules;
DROP POLICY IF EXISTS "Users can update on-call schedules for their organizations" ON public.on_call_schedules;
DROP POLICY IF EXISTS "Users can delete on-call schedules for their organizations" ON public.on_call_schedules;

-- Step 4: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.on_call_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.on_call_schedules TO anon;

COMMIT;

-- Verify the schema
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
ORDER BY ordinal_position;