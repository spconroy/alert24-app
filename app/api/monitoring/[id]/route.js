import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: checkId } = params;
    const body = await req.json();

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

    // Validate that user has access to this monitoring check
    const existingCheck = await db.getMonitoringCheckById(checkId);
    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(
      existingCheck.organization_id,
      user.id
    );
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Update monitoring check
    const updatedCheck = await db.updateMonitoringCheck(checkId, body);

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

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: checkId } = params;

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

    // Validate that user has access to this monitoring check
    const existingCheck = await db.getMonitoringCheckById(checkId);
    if (!existingCheck) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(
      existingCheck.organization_id,
      user.id
    );
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
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
