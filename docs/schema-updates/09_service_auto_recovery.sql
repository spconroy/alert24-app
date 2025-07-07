-- Add auto_recovery column to services table
-- This controls whether a service automatically returns to 'operational' status
-- when all its monitoring checks recover

ALTER TABLE public.services 
ADD COLUMN auto_recovery BOOLEAN DEFAULT true;

-- Add a comment to explain the column
COMMENT ON COLUMN public.services.auto_recovery IS 
'Controls whether the service automatically returns to operational status when all monitoring checks recover';

-- Update existing services to have auto_recovery enabled by default
UPDATE public.services SET auto_recovery = true WHERE auto_recovery IS NULL;

-- Verify the change
SELECT 'auto_recovery column added to services table' as result; 