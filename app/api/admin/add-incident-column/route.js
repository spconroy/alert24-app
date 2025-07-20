import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function POST() {
  try {
    // For Supabase, we need to run the SQL in the SQL Editor
    // This endpoint will provide the SQL commands to run manually
    
    const sqlCommands = `
-- Add incident_number column to incidents table
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS incident_number INTEGER;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_incidents_org_number 
ON incidents(organization_id, incident_number);

-- Update existing incidents with incident numbers
WITH numbered_incidents AS (
  SELECT 
    id,
    organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as new_incident_number
  FROM incidents 
  WHERE incident_number IS NULL
)
UPDATE incidents 
SET incident_number = numbered_incidents.new_incident_number
FROM numbered_incidents 
WHERE incidents.id = numbered_incidents.id;
    `;

    return NextResponse.json({
      success: true,
      message: 'SQL commands ready to execute',
      instructions: 'Copy and paste the following SQL into your Supabase SQL Editor:',
      sql: sqlCommands,
      note: 'After running this SQL, refresh the incident page to see incident numbers.'
    });

  } catch (error) {
    console.error('Error generating SQL:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: 'Failed to generate migration SQL'
      },
      { status: 500 }
    );
  }
}