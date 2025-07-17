import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { SupabaseClient } from '../../../../lib/db-supabase.js';
import { authOptions } from '../../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get on-call schedule with organization access check
    const schedule = await db.getOnCallScheduleById(id, user.id);

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found or access denied' },
        { status: 404 }
      );
    }

    // Transform the data to match expected format
    const formattedSchedule = {
      ...schedule,
      organization_name: schedule.organizations?.name,
    };

    return NextResponse.json({
      success: true,
      schedule: formattedSchedule,
    });
  } catch (error) {
    console.error('Error fetching on-call schedule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch on-call schedule',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if schedule exists and user has access
    const existingSchedule = await db.getOnCallScheduleById(id, user.id);
    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found or access denied' },
        { status: 404 }
      );
    }

    // Check permissions
    const membership = await db.getOrganizationMember(
      existingSchedule.organization_id,
      user.id
    );
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can update on-call schedules',
        },
        { status: 403 }
      );
    }

    // Update on-call schedule
    const updatedSchedule = await db.updateOnCallSchedule(id, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      schedule: updatedSchedule,
      message: 'On-call schedule updated successfully',
    });
  } catch (error) {
    console.error('Error updating on-call schedule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update on-call schedule',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if schedule exists and user has access
    const existingSchedule = await db.getOnCallScheduleById(id, user.id);
    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found or access denied' },
        { status: 404 }
      );
    }

    // Check permissions
    const membership = await db.getOrganizationMember(
      existingSchedule.organization_id,
      user.id
    );
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can delete on-call schedules',
        },
        { status: 403 }
      );
    }

    // Delete on-call schedule
    await db.deleteOnCallSchedule(id);

    return NextResponse.json({
      success: true,
      message: 'On-call schedule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting on-call schedule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete on-call schedule',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
