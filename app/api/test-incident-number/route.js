import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET() {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if incident_number column exists by trying to select it
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, incident_number, title, organization_id, created_at')
      .limit(5);

    if (error) {
      if (error.message.includes('incident_number')) {
        return NextResponse.json({
          success: false,
          message: 'incident_number column does not exist yet',
          error: error.message,
          needsMigration: true
        });
      }
      throw error;
    }

    // Check how many incidents have incident numbers vs null
    const withNumbers = incidents.filter(i => i.incident_number !== null).length;
    const withoutNumbers = incidents.filter(i => i.incident_number === null).length;

    return NextResponse.json({
      success: true,
      message: 'incident_number column exists',
      incidents: incidents,
      summary: {
        totalChecked: incidents.length,
        withIncidentNumbers: withNumbers,
        withoutIncidentNumbers: withoutNumbers,
        needsNumbering: withoutNumbers > 0
      }
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: 'Failed to test incident_number functionality'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Try to add incident_number column if it doesn't exist
    // Note: This approach uses a workaround since we can't execute DDL directly
    
    // First, try to update existing incidents without incident numbers
    const { data: incidentsToNumber, error: fetchError } = await supabase
      .from('incidents')
      .select('id, organization_id, created_at')
      .is('incident_number', null)
      .order('organization_id')
      .order('created_at');

    if (fetchError) {
      throw fetchError;
    }

    if (incidentsToNumber && incidentsToNumber.length > 0) {
      // Group by organization and assign numbers
      const orgGroups = {};
      incidentsToNumber.forEach(incident => {
        if (!orgGroups[incident.organization_id]) {
          orgGroups[incident.organization_id] = [];
        }
        orgGroups[incident.organization_id].push(incident);
      });

      const updatePromises = [];
      for (const [orgId, incidents] of Object.entries(orgGroups)) {
        // Get the current max incident number for this org
        const { data: maxData } = await supabase
          .from('incidents')
          .select('incident_number')
          .eq('organization_id', orgId)
          .not('incident_number', 'is', null)
          .order('incident_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextNumber = (maxData?.incident_number || 0) + 1;

        for (const incident of incidents) {
          updatePromises.push(
            supabase
              .from('incidents')
              .update({ incident_number: nextNumber })
              .eq('id', incident.id)
          );
          nextNumber++;
        }
      }

      const results = await Promise.all(updatePromises);
      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;

      return NextResponse.json({
        success: true,
        message: `Updated incident numbers for existing incidents`,
        updated: successful,
        failed: failed,
        totalProcessed: incidentsToNumber.length
      });
    }

    return NextResponse.json({
      success: true,
      message: 'All incidents already have incident numbers',
      updated: 0
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: 'Failed to update incident numbers'
      },
      { status: 500 }
    );
  }
}