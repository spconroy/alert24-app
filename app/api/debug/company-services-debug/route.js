import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase.js';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const db = new SupabaseClient();
    const slug = 'company-services';
    
    // Get status page details
    const { data: statusPages, error: statusPageError } = await db.client
      .from('status_pages')
      .select(`
        *,
        organizations!inner (
          id,
          name
        )
      `)
      .eq('slug', slug)
      .eq('is_public', true)
      .limit(1);

    if (statusPageError) {
      return NextResponse.json({ error: 'Status page error', details: statusPageError });
    }

    const statusPage = statusPages[0];
    if (!statusPage) {
      return NextResponse.json({ error: 'Status page not found' });
    }

    // Get services for this status page
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPage.id)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (servicesError) {
      return NextResponse.json({ error: 'Services error', details: servicesError });
    }

    const actualServices = (services || []).filter(
      service => !service.name?.startsWith('[MONITORING]')
    );

    // Get recent incidents with updates
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: incidents, error: incidentsError } = await db.client
      .from('incidents')
      .select('id, title, affected_services, status, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (incidentsError) {
      return NextResponse.json({ error: 'Incidents error', details: incidentsError });
    }

    // Get incident updates separately
    const incidentIds = incidents?.map(i => i.id) || [];
    let incidentUpdates = [];
    
    if (incidentIds.length > 0) {
      const { data: updates, error: updatesError } = await db.adminClient
        .from('incident_updates')
        .select(`
          id, 
          incident_id, 
          message, 
          status, 
          created_at, 
          user_id,
          users (
            name,
            email
          )
        `)
        .in('incident_id', incidentIds)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!updatesError && updates) {
        incidentUpdates = updates;
      }
    }

    // Group updates by incident
    const updatesByIncident = incidentUpdates.reduce((acc, update) => {
      if (!acc[update.incident_id]) acc[update.incident_id] = [];
      acc[update.incident_id].push(update);
      return acc;
    }, {});

    // Add updates to incidents
    const incidentsWithUpdates = (incidents || []).map(incident => ({
      ...incident,
      incident_updates: updatesByIncident[incident.id] || []
    }));

    // Filter logic
    const serviceNames = actualServices.map(s => s.name);
    const debugInfo = {
      statusPageId: statusPage.id,
      statusPageName: statusPage.name,
      serviceNames,
      serviceCount: actualServices.length,
      incidentsCount: incidentsWithUpdates.length,
      incidentUpdatesCount: incidentUpdates.length,
      incidents: incidentsWithUpdates.map(i => ({
        id: i.id,
        title: i.title,
        affected_services: i.affected_services,
        updates_count: i.incident_updates?.length || 0,
        sample_update: i.incident_updates?.[0]
      }))
    };

    // Filter incidents that affect services on this status page
    const filteredIncidents = incidentsWithUpdates.filter(incident => {
      const hasMatchingService = incident.affected_services?.some(service => 
        serviceNames.includes(service)
      );
      return hasMatchingService;
    });

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      filteredIncidentsCount: filteredIncidents.length,
      filteredIncidents: filteredIncidents.map(i => ({
        id: i.id,
        title: i.title,
        affected_services: i.affected_services,
        updates_count: i.incident_updates?.length || 0
      }))
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}