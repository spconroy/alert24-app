-- Add missing columns to escalation_policies table to match API expectations

-- Add created_by column
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add escalation_timeout_minutes (API expects this instead of escalation_delay_minutes)
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS escalation_timeout_minutes INTEGER DEFAULT 30;

-- Add escalation_steps JSONB column
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS escalation_steps JSONB DEFAULT '[]'::jsonb;

-- Add notification_config JSONB column  
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS notification_config JSONB DEFAULT '{}'::jsonb;

-- Add is_active boolean column
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add deleted_at column for soft deletes
ALTER TABLE escalation_policies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_escalation_policies_created_by ON escalation_policies(created_by);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_is_active ON escalation_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_deleted_at ON escalation_policies(deleted_at);

-- Verify all columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'escalation_policies' 
AND column_name IN ('created_by', 'escalation_timeout_minutes', 'escalation_steps', 'notification_config', 'is_active', 'deleted_at')
ORDER BY column_name;