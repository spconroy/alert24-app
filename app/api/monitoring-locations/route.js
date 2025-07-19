import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get user (for permission checking, though locations are global)
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring locations
    const locations = await db.getMonitoringLocations({
      active_only: activeOnly,
    });

    return NextResponse.json({
      success: true,
      monitoring_locations: locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('Error fetching monitoring locations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring locations',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      code,
      description,
      region,
      country,
      city,
      latitude,
      longitude,
      is_active = true,
      is_default = false,
    } = body;

    // Validation
    if (!name || !code || !region || !country) {
      return NextResponse.json(
        { error: 'Name, code, region, and country are required' },
        { status: 400 }
      );
    }

    // Get user (only admins can create locations)
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is a system admin or organization owner
    // For now, we'll allow any authenticated user to create locations
    // In production, you'd want to restrict this to super admins

    const locationData = {
      name,
      code,
      description,
      region,
      country,
      city,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      is_active,
      is_default,
    };

    const location = await db.createMonitoringLocation(locationData);

    return NextResponse.json(
      {
        success: true,
        monitoring_location: location,
        message: 'Monitoring location created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating monitoring location:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create monitoring location',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
