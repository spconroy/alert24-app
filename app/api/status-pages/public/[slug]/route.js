import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Status page slug is required' },
        { status: 400 }
      );
    }

    // Get status page by slug - public access
    const { data: statusPages, error: statusPageError } = await db.client
      .from('status_pages')
      .select(
        `
        *,
        organizations!inner (
          id,
          name
        )
      `
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .limit(1);

    if (statusPageError) {
      console.error('Error fetching status page:', statusPageError);
      return NextResponse.json(
        { error: 'Failed to fetch status page' },
        { status: 500 }
      );
    }

    if (!statusPages || statusPages.length === 0) {
      return NextResponse.json(
        { error: 'Status page not found or is not public' },
        { status: 404 }
      );
    }

    const statusPage = statusPages[0];

    // Add organization name to status page object
    statusPage.organization_name = statusPage.organizations.name;

    // Get services for this status page (NOT monitoring checks)
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPage.id)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return NextResponse.json(
        { error: 'Failed to fetch services' },
        { status: 500 }
      );
    }

    // Filter out any monitoring check workarounds (services that start with [MONITORING])
    const actualServices = (services || []).filter(
      service => !service.name?.startsWith('[MONITORING]')
    );

    // Get recent status updates for this status page
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch regular status updates
    const { data: statusUpdates, error: updatesError } = await db.client
      .from('status_updates')
      .select(
        `
        *,
        services (
          id,
          name
        )
      `
      )
      .eq('status_page_id', statusPage.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (updatesError) {
      console.error('Error fetching status updates:', updatesError);
      // Don't fail the request for status updates error, just log it
    }

    // Fetch public incident updates for services on this status page
    let publicIncidentUpdates = [];
    if (actualServices && actualServices.length > 0) {
      try {
        // Since visible_to_public column might not exist, get all incident updates
        // and filter client-side for now
        // Get incidents first, then get their updates separately to avoid join issues
        const { data: incidents, error: incidentsError } = await db.client
          .from('incidents')
          .select('id, title, affected_services, status, created_at')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (!incidentsError && incidents && incidents.length > 0) {
          // Get incident updates for these incidents
          const incidentIds = incidents.map(i => i.id);
          const { data: incidentUpdates, error: updatesError } = await db.adminClient
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

          if (!updatesError && incidentUpdates) {
            // Group updates by incident
            const updatesByIncident = incidentUpdates.reduce((acc, update) => {
              if (!acc[update.incident_id]) acc[update.incident_id] = [];
              acc[update.incident_id].push(update);
              return acc;
            }, {});

            // Add updates to incidents
            incidents.forEach(incident => {
              incident.incident_updates = updatesByIncident[incident.id] || [];
            });
          }
        }

        if (!incidentsError && incidents) {
          // Filter incidents that affect services on this status page
          const serviceNames = actualServices.map(s => s.name);
          const serviceIds = actualServices.map(s => s.id);
          
          const filteredIncidents = incidents.filter(incident => {
            // Check if any affected service ID or name is on this status page
            const hasMatchingService = incident.affected_services?.some(service => {
              // Handle both service IDs and service names
              if (typeof service === 'string') {
                // If it looks like a UUID, check against service IDs
                if (service.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  return serviceIds.includes(service);
                }
                // Otherwise check against service names
                return serviceNames.includes(service);
              }
              // Handle service objects (like in one of the incidents)
              if (service && typeof service === 'object' && service.id) {
                return serviceIds.includes(service.id);
              }
              return false;
            });
            return hasMatchingService;
          });
          
          publicIncidentUpdates = filteredIncidents
            .flatMap(incident => 
              incident.incident_updates.map(update => ({
                ...update,
                type: 'incident_update',
                incident_id: incident.id,
                incident_title: incident.title,
                incident_status: incident.status,
                affected_services: incident.affected_services,
                posted_by_user: update.users,
                // For now, assume all incident updates should be visible on status page
                // TODO: Filter by visible_to_public when column exists
                visible_to_public: true
              }))
            )
            .slice(0, 25); // Limit incident updates
        }
      } catch (incidentError) {
        console.error('Error fetching public incident updates:', incidentError);
      }
    }

    // Combine and sort all updates by created_at
    const allUpdates = [
      ...(statusUpdates || []).map(update => ({ ...update, type: 'status_update' })),
      ...publicIncidentUpdates
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
     .slice(0, 50); // Limit total updates

    return NextResponse.json({
      success: true,
      statusPage,
      services: actualServices,
      statusUpdates: allUpdates,
    });
  } catch (error) {
    console.error('Error in public status page API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
