import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../lib/db-supabase.js';
import { authOptions } from '../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const checkType = searchParams.get('check_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring checks with filters
    const filters = {
      organization_id: organizationId,
      check_type: checkType,
      status,
      limit,
      offset,
    };

    const monitoringChecks = await db.getMonitoringChecks(user.id, filters);

    // Transform the data to match expected format
    const formattedChecks = monitoringChecks.map(check => ({
      ...check,
      is_active: check.status === 'active',
      organization_name: check.organizations?.name,
      created_by_name: check.created_by_user?.name,
      created_by_email: check.created_by_user?.email,
    }));

    return NextResponse.json({
      success: true,
      monitoring_checks: formattedChecks,
      count: formattedChecks.length,
    });
  } catch (error) {
    console.error('Error fetching monitoring checks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring checks',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      check_type,
      target_url,
      check_interval_minutes = 5,
      timeout_seconds = 30,
      organization_id,
      expected_response_code = 200,
      expected_response_body,
      notification_config = {},
    } = body;

    // Validation
    if (!name || !check_type || !organization_id) {
      return NextResponse.json(
        { error: 'Name, check_type, and organization_id are required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(organization_id, user.id);
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Create monitoring check
    const checkData = {
      name,
      check_type,
      target_url,
      check_interval_minutes,
      timeout_seconds,
      organization_id,
      created_by: user.id,
      expected_response_code,
      expected_response_body,
      notification_config,
      status: 'active',
    };

    const monitoringCheck = await db.createMonitoringCheck(checkData);

    return NextResponse.json(
      {
        success: true,
        monitoring_check: monitoringCheck,
        message: 'Monitoring check created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get('id');

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update monitoring check
    const updatedCheck = await db.updateMonitoringCheck(checkId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      monitoring_check: updatedCheck,
      message: 'Monitoring check updated successfully',
    });
  } catch (error) {
    console.error('Error updating monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get('id');

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete monitoring check
    await db.deleteMonitoringCheck(checkId);

    return NextResponse.json({
      success: true,
      message: 'Monitoring check deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
