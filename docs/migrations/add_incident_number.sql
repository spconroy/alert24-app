-- Migration: Add incident_number field to incidents table
-- This adds per-organization incident numbering

-- Add the incident_number column
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS incident_number INTEGER;

-- Create an index for faster lookups when generating new incident numbers
CREATE INDEX IF NOT EXISTS idx_incidents_org_number 
ON incidents(organization_id, incident_number);

-- Update existing incidents to have incident numbers
-- This will assign incident numbers based on creation order within each organization
WITH numbered_incidents AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as new_incident_number
  FROM incidents 
  WHERE incident_number IS NULL
)
UPDATE incidents 
SET incident_number = numbered_incidents.new_incident_number
FROM numbered_incidents 
WHERE incidents.id = numbered_incidents.id;

-- Add a comment to document the field
COMMENT ON COLUMN incidents.incident_number IS 'Sequential incident number within organization, starts at 1 for each org';