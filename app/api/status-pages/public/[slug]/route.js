import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req, { params }) {
  try {
    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Status page slug is required' },
        { status: 400 }
      );
    }

    // Get status page by slug with organization info (no authentication required for public pages)
    const { data: statusPage, error: statusPageError } = await db.client
      .from('status_pages')
      .select(
        `
        *,
        organizations (
          name,
          slug
        )
      `
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (statusPageError || !statusPage) {
      console.error('Status page not found or error:', statusPageError);
      return NextResponse.json(
        { error: 'Status page not found or not public' },
        { status: 404 }
      );
    }

    // Get all services for this status page (excluding monitoring check workarounds)
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPage.id)
      .is('deleted_at', null)
      .not('name', 'ilike', '[[]MONITORING]%')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      // Don't fail if services can't be loaded, just return empty array
    }

    // Get recent status updates for this status page
    const { data: statusUpdates, error: updatesError } = await db.client
      .from('status_updates')
      .select('*')
      .eq('status_page_id', statusPage.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (updatesError) {
      console.error('Error fetching status updates:', updatesError);
    }

    const responseData = {
      statusPage: {
        ...statusPage,
        organization_name: statusPage.organizations?.name,
        organization_slug: statusPage.organizations?.slug,
      },
      services: services || [],
      statusUpdates: statusUpdates || [],
    };

    return NextResponse.json({
      success: true,
      ...responseData,
    });
  } catch (error) {
    console.error('Error fetching public status page data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch status page data',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
