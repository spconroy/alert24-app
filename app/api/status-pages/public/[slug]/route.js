import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../../lib/db-supabase.js';

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

    return NextResponse.json({
      success: true,
      statusPage,
      services: actualServices,
      statusUpdates: statusUpdates || [],
    });
  } catch (error) {
    console.error('Error in public status page API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
