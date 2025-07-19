import { supabase } from '@/lib/db-supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { organizationId, dateRange, services } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '1d': startDate.setDate(endDate.getDate() - 1); break;
      case '7d': startDate.setDate(endDate.getDate() - 7); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); break;
      default: startDate.setDate(endDate.getDate() - 7);
    }

    // Get incidents for the organization in the date range
    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (incidentsError) {
      console.error('Error fetching incidents:', incidentsError);
      return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
    }

    // Process incidents data
    const processedIncidents = (incidents || []).map(incident => {
      const created = new Date(incident.created_at);
      const resolved = incident.resolved_at ? new Date(incident.resolved_at) : null;
      const acknowledged = incident.acknowledged_at ? new Date(incident.acknowledged_at) : null;
      
      const duration = resolved ? Math.round((resolved - created) / (1000 * 60)) : 0; // minutes
      const acknowledgmentTime = acknowledged ? Math.round((acknowledged - created) / (1000 * 60)) : 0; // minutes

      return {
        ...incident,
        duration,
        acknowledgmentTime
      };
    });

    // Calculate summary metrics
    const totalIncidents = processedIncidents.length;
    const openIncidents = processedIncidents.filter(i => i.status !== 'resolved').length;
    
    const resolvedIncidents = processedIncidents.filter(i => i.resolved_at);
    const mttr = resolvedIncidents.length > 0
      ? Math.round(resolvedIncidents.reduce((sum, i) => sum + i.duration, 0) / resolvedIncidents.length)
      : 0;

    const acknowledgedIncidents = processedIncidents.filter(i => i.acknowledged_at);
    const mtta = acknowledgedIncidents.length > 0
      ? Math.round(acknowledgedIncidents.reduce((sum, i) => sum + i.acknowledgmentTime, 0) / acknowledgedIncidents.length)
      : 0;

    // Count by severity
    const severityCounts = {
      critical: processedIncidents.filter(i => i.severity === 'critical').length,
      high: processedIncidents.filter(i => i.severity === 'high').length,
      medium: processedIncidents.filter(i => i.severity === 'medium').length,
      low: processedIncidents.filter(i => i.severity === 'low').length
    };

    // Get recent incidents (limit to 10)
    const recentIncidents = processedIncidents.slice(0, 10);

    return NextResponse.json({
      summary: {
        totalIncidents,
        openIncidents,
        mttr,
        mtta,
        severity: severityCounts
      },
      recentIncidents,
      timeline: [] // Could add timeline processing here
    });

  } catch (error) {
    console.error('Error in analytics incidents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}