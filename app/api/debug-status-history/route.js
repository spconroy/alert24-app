import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    // Get Audio Generation Service ID (the one showing as outage)
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('id, name, status')
      .ilike('name', '%Audio Generation%')
      .limit(1);

    if (servicesError) {
      return NextResponse.json({ error: 'Failed to fetch service', details: servicesError.message }, { status: 500 });
    }

    if (!services || services.length === 0) {
      return NextResponse.json({ error: 'Audio Generation Service not found' }, { status: 404 });
    }

    const service = services[0];

    // Check current status history for this service using admin client
    const client = db.adminClient || db.client;
    const { data: statusHistory, error: historyError } = await client
      .from('service_status_history')
      .select('*')
      .eq('service_id', service.id)
      .order('started_at', { ascending: false })
      .limit(10);

    if (historyError) {
      return NextResponse.json({ 
        error: 'Failed to fetch status history', 
        details: historyError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      service: service,
      statusHistory: statusHistory,
      historyCount: statusHistory?.length || 0,
      currentServiceStatus: service.status,
      message: statusHistory?.length === 0 
        ? 'No status history found - trigger may not be working'
        : 'Status history found'
    });

  } catch (error) {
    console.error('Error in debug status history:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error.message,
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_history') {
      // Create realistic historical data for Audio Generation Service
      const { data: services, error: servicesError } = await db.client
        .from('services')
        .select('id, name, status')
        .ilike('name', '%Audio Generation%')
        .limit(1);

      if (servicesError || !services || services.length === 0) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }

      const service = services[0];
      const client = db.adminClient || db.client;

      // Clear existing history first
      await client
        .from('service_status_history')
        .delete()
        .eq('service_id', service.id);

      // Create historical periods over the last 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const historyEntries = [
        // Operational for most of the time
        {
          service_id: service.id,
          status: 'operational',
          started_at: sevenDaysAgo.toISOString(),
          ended_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // Degraded for 4 hours 2 days ago
        {
          service_id: service.id,
          status: 'degraded', 
          started_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
        },
        // Back to operational
        {
          service_id: service.id,
          status: 'operational',
          started_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          ended_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        },
        // Current outage started 1 hour ago
        {
          service_id: service.id,
          status: 'down',
          started_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          ended_at: null, // Ongoing
        },
      ];

      const { data: insertResults, error: insertError } = await client
        .from('service_status_history')
        .insert(historyEntries)
        .select();

      return NextResponse.json({
        success: !insertError,
        message: 'Created realistic history',
        serviceId: service.id,
        entriesCreated: insertResults?.length || 0,
        insertError: insertError?.message || null,
        historyEntries: insertResults,
      });
    }

    if (action === 'direct_insert') {
      // Get Audio Generation Service
      const { data: services, error: servicesError } = await db.client
        .from('services')
        .select('id, name, status')
        .ilike('name', '%Audio Generation%')
        .limit(1);

      if (servicesError || !services || services.length === 0) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }

      const service = services[0];

      // Try direct insert into service_status_history table using admin client
      const client = db.adminClient || db.client;
      const { data: insertResult, error: insertError } = await client
        .from('service_status_history')
        .insert({
          service_id: service.id,
          status: service.status,
          started_at: new Date().toISOString(),
          ended_at: null,
        })
        .select()
        .single();

      return NextResponse.json({
        success: !insertError,
        message: 'Direct insert attempt',
        serviceId: service.id,
        currentStatus: service.status,
        insertResult: insertResult,
        insertError: insertError?.message || null,
      });
    }

    if (action === 'manual_track') {
      // Get Audio Generation Service
      const { data: services, error: servicesError } = await db.client
        .from('services')
        .select('id, name, status')
        .ilike('name', '%Audio Generation%')
        .limit(1);

      if (servicesError || !services || services.length === 0) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }

      const service = services[0];

      // Manually call trackServiceStatusChange to force create a status history entry
      console.log('Manually tracking status change for service:', service.id, 'status:', service.status);
      const success = await db.trackServiceStatusChange(service.id, service.status, 'operational');
      
      // Check if entry was created using admin client
      const checkClient = db.adminClient || db.client;
      const { data: newHistory, error: checkError } = await checkClient
        .from('service_status_history')
        .select('*')
        .eq('service_id', service.id)
        .order('started_at', { ascending: false })
        .limit(1);

      return NextResponse.json({
        success: true,
        message: 'Manually tracked status change',
        serviceId: service.id,
        currentStatus: service.status,
        trackingSuccess: success,
        newHistoryEntry: newHistory?.[0] || null,
        checkError: checkError?.message || null,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Error in debug status history POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug POST failed',
      details: error.message,
    }, { status: 500 });
  }
}