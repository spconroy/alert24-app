import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    console.log('Testing services API for organization:', organizationId);

    // First, let's check if there are any status pages for this organization
    const { data: statusPages, error: statusError } = await db.client
      .from('status_pages')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);

    if (statusError) {
      console.error('Error fetching status pages:', statusError);
      return NextResponse.json(
        { error: 'Failed to fetch status pages', details: statusError.message },
        { status: 500 }
      );
    }

    console.log('Found status pages:', statusPages?.length || 0);

    // Now let's check for services
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select(
        `
        *,
        status_pages!inner(
          id,
          name,
          organization_id
        )
      `
      )
      .eq('status_pages.organization_id', organizationId)
      .is('deleted_at', null)
      .not('name', 'ilike', '[[]MONITORING]%');

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      return NextResponse.json(
        { error: 'Failed to fetch services', details: servicesError.message },
        { status: 500 }
      );
    }

    console.log('Found services:', services?.length || 0);

    return NextResponse.json({
      success: true,
      organization_id: organizationId,
      status_pages: statusPages || [],
      services: services || [],
      message: `Found ${statusPages?.length || 0} status pages and ${services?.length || 0} services for organization ${organizationId}`,
    });
  } catch (error) {
    console.error('Error in test services API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
