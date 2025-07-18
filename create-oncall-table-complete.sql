-- Create complete on_call_schedules table with all required columns
-- This will either create the table or add missing columns

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS on_call_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add all missing columns one by one
DO $$
BEGIN
    -- Add rotation_config column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'rotation_config'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN rotation_config JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added rotation_config column';
    END IF;

    -- Add members column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'members'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN members JSONB NOT NULL DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added members column';
    END IF;

    -- Add overrides column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'overrides'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN overrides JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added overrides column';
    END IF;

    -- Add schedule_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'schedule_type'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN schedule_type VARCHAR(50) NOT NULL DEFAULT 'rotation';
        RAISE NOTICE 'Added schedule_type column';
    END IF;

    -- Add created_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'on_call_schedules' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.on_call_schedules ADD COLUMN created_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added created_by column';
    END IF;
END $$;

-- Disable RLS
ALTER TABLE on_call_schedules DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON on_call_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON on_call_schedules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON on_call_schedules TO service_role;

-- Verify the final table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'on_call_schedules' 
ORDER BY ordinal_position;