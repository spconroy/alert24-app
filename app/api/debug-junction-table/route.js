import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const checkId =
      url.searchParams.get('check_id') ||
      'ad1639a7-a9dd-41a9-92fa-cdd3a80d46fc';
    const serviceId =
      url.searchParams.get('service_id') ||
      '2d1cb536-2a7b-4916-a81a-ee6e536127c9';

    console.log(
      `Debugging junction table for check ${checkId} and service ${serviceId}`
    );

    // Check if the service_monitoring_checks table exists and has data
    const { data: junctionData, error: junctionError } = await db.client
      .from('service_monitoring_checks')
      .select('*')
      .eq('monitoring_check_id', checkId);

    if (junctionError) {
      console.error('Junction table query error:', junctionError);
    }

    // Also check the opposite direction
    const { data: serviceJunctionData, error: serviceJunctionError } =
      await db.client
        .from('service_monitoring_checks')
        .select('*')
        .eq('service_id', serviceId);

    if (serviceJunctionError) {
      console.error(
        'Service junction table query error:',
        serviceJunctionError
      );
    }

    // Check the monitoring check details
    const { data: checkData, error: checkError } = await db.client
      .from('monitoring_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    // Check the service details
    const { data: serviceData, error: serviceError } = await db.client
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    return NextResponse.json({
      success: true,
      debug: {
        checkId,
        serviceId,
        junction_table_for_check: {
          data: junctionData,
          error: junctionError,
          count: junctionData?.length || 0,
        },
        junction_table_for_service: {
          data: serviceJunctionData,
          error: serviceJunctionError,
          count: serviceJunctionData?.length || 0,
        },
        monitoring_check: {
          data: checkData,
          error: checkError,
        },
        service: {
          data: serviceData,
          error: serviceError,
        },
      },
    });
  } catch (error) {
    console.error('Debug junction table error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Debug failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
