-- Fix status_updates table schema to allow NULL status for general updates
-- Drop the existing constraint and make status nullable

-- First, drop the check constraint on status
ALTER TABLE public.status_updates DROP CONSTRAINT IF EXISTS status_updates_status_check;

-- Make the status column nullable
ALTER TABLE public.status_updates ALTER COLUMN status DROP NOT NULL;

-- Add a new check constraint that allows NULL or the specified values
ALTER TABLE public.status_updates 
ADD CONSTRAINT status_updates_status_check 
CHECK (status IS NULL OR status IN ('investigating', 'identified', 'monitoring', 'resolved', 'operational', 'degraded', 'down', 'maintenance'));

-- Update existing general updates to have NULL status if they currently have 'operational'
UPDATE public.status_updates 
SET status = NULL 
WHERE update_type = 'general' AND status = 'operational'; 