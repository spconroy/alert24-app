import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const filters = {
      organization_id: organizationId,
      active_only: activeOnly,
    };

    // Get on-call schedules
    const onCallSchedules = await db.getOnCallSchedules(user.id, filters);

    // Transform the data to match expected format
    const formattedSchedules = onCallSchedules.map(schedule => ({
      ...schedule,
      organization_name: schedule.organizations?.name,
    }));

    return NextResponse.json({
      success: true,
      on_call_schedules: formattedSchedules,
      count: formattedSchedules.length,
    });
  } catch (error) {
    console.error('Error fetching on-call schedules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch on-call schedules',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description = '',
      organization_id,
      rotation_config = {},
      rotation_type,
      rotation_interval_hours,
      rotation_day,
      rotation_time,
      participants = [],
      start_date,
      end_date,
      is_active = true,
      timezone = 'UTC',
    } = body;

    // Validation
    if (!name || !organization_id) {
      return NextResponse.json(
        { error: 'Name and organization_id are required' },
        { status: 400 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'At least one participant is required' },
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
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can create on-call schedules',
        },
        { status: 403 }
      );
    }

    // Transform frontend data to database format
    const transformedRotationConfig = rotation_type
      ? {
          type: rotation_type,
          duration_hours: rotation_interval_hours || 168,
          start_time: rotation_time
            ? `${rotation_time.hour.toString().padStart(2, '0')}:${rotation_time.minute.toString().padStart(2, '0')}`
            : '09:00',
          handoff_time: rotation_time
            ? `${rotation_time.hour.toString().padStart(2, '0')}:${rotation_time.minute.toString().padStart(2, '0')}`
            : '09:00',
          rotation_day: rotation_day,
          schedule_start: start_date,
          schedule_end: end_date,
        }
      : rotation_config;

    const transformedMembers = participants.map((participant, index) => ({
      user_id: participant.id || participant,
      order: index + 1,
    }));

    // Create on-call schedule
    const scheduleData = {
      name,
      description,
      organization_id,
      rotation_config: transformedRotationConfig,
      members: transformedMembers,
      is_active,
      timezone,
    };

    const onCallSchedule = await db.createOnCallSchedule(scheduleData);

    return NextResponse.json(
      {
        success: true,
        on_call_schedule: onCallSchedule,
        message: 'On-call schedule created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating on-call schedule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create on-call schedule',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'On-call schedule ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if schedule exists and user has access
    const existingSchedule = await db.getOnCallScheduleById(
      scheduleId,
      user.id
    );
    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'On-call schedule not found or access denied' },
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
    const updatedSchedule = await db.updateOnCallSchedule(scheduleId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      on_call_schedule: updatedSchedule,
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

export async function DELETE(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'On-call schedule ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if schedule exists and user has access
    const existingSchedule = await db.getOnCallScheduleById(
      scheduleId,
      user.id
    );
    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'On-call schedule not found or access denied' },
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
    await db.deleteOnCallSchedule(scheduleId);

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
