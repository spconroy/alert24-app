-- Add auto_recovery column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT true;

-- Update existing services to have auto_recovery enabled by default
UPDATE services SET auto_recovery = true WHERE auto_recovery IS NULL; 