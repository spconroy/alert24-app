import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json({ error: 'Slug parameter required' }, { status: 400 });
    }

    const db = new SupabaseClient();

    // Get the status page
    const { data: statusPage, error: statusPageError } = await db.client
      .from('status_pages')
      .select('*')
      .eq('slug', slug)
      .single();

    if (statusPageError || !statusPage) {
      return NextResponse.json({ 
        error: 'Status page not found',
        details: statusPageError?.message 
      }, { status: 404 });
    }

    // Get services for this status page
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPage.id)
      .is('deleted_at', null);

    // Get recent incidents with updates
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: incidents, error: incidentsError } = await db.client
      .from('incidents')
      .select(`
        id,
        title,
        affected_services,
        status,
        created_at,
        incident_updates (
          id,
          message,
          status,
          created_at,
          user_id,
          users (
            name,
            email
          )
        )
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      statusPage: {
        id: statusPage.id,
        name: statusPage.name,
        slug: statusPage.slug
      },
      services: services || [],
      incidents: incidents || [],
      serviceNames: services?.map(s => s.name) || [],
      errors: {
        statusPageError: statusPageError?.message,
        servicesError: servicesError?.message,
        incidentsError: incidentsError?.message
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}