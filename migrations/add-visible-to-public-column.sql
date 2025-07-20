-- Add visible_to_public column to incident_updates table
ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS visible_to_public BOOLEAN DEFAULT false;

-- Also add other missing columns from the schema for completeness
ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS update_type VARCHAR(50) DEFAULT 'update';

ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS visible_to_subscribers BOOLEAN DEFAULT true;

ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS notified_channels TEXT[];

ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE incident_updates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();