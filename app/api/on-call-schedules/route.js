import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Pool } from 'pg';
import { authOptions } from '../auth/[...nextauth]/route.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get user ID
    const userRes = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }

    // Build the query with proper schema structure
    let query = `
      SELECT ocs.*,
             o.name as organization_name,
             CASE 
               WHEN NOW() BETWEEN COALESCE(
                 (ocs.rotation_config->>'start_date')::timestamp,
                 ocs.created_at
               ) AND COALESCE(
                 (ocs.rotation_config->>'end_date')::timestamp,
                 ocs.created_at + INTERVAL '30 days'
               ) THEN true
               ELSE false
             END as is_currently_active
      FROM public.on_call_schedules ocs
      JOIN public.organizations o ON ocs.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      WHERE om.user_id = $1 AND om.is_active = true
    `;

    const params = [user.id];
    let paramIndex = 2;

    // Add filters
    if (organizationId) {
      query += ` AND ocs.organization_id = $${paramIndex}`;
      params.push(organizationId);
      paramIndex++;
    }

    if (activeOnly) {
      query += ` AND ocs.is_active = true`;
    }

    query += ` ORDER BY ocs.created_at DESC`;

    const result = await pool.query(query, params);
    console.log(
      'On-call schedules query result:',
      result.rows.length,
      'schedules found'
    );

    // Process the results to extract current on-call person
    const schedules = result.rows.map(schedule => {
      const members = schedule.members || [];
      const rotationConfig = schedule.rotation_config || {};

      // Simple rotation logic - for demo purposes
      let currentOnCallMember = null;
      if (members.length > 0) {
        const now = new Date();
        const dayOfYear = Math.floor(
          (now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
        );
        const rotationIndex = dayOfYear % members.length;
        currentOnCallMember = members[rotationIndex];
      }

      return {
        ...schedule,
        current_on_call_member: currentOnCallMember,
        members_count: members.length,
      };
    });

    return new Response(
      JSON.stringify({
        on_call_schedules: schedules,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('GET on-call schedules error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const {
      organization_id,
      name,
      description = '',
      start_date,
      end_date,
      rotation_type = 'weekly',
      rotation_interval_hours = 168,
      rotation_day = 1, // Monday by default
      participants = [],
      timezone = 'UTC',
      is_active = true,
    } = body;

    // Validation
    if (!organization_id || !name || !start_date) {
      return new Response(
        JSON.stringify({
          error: 'Organization ID, name, and start date are required',
        }),
        { status: 400 }
      );
    }

    if (participants.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'At least one participant is required',
        }),
        { status: 400 }
      );
    }

    // Validate date range (only if end_date is provided)
    const startDateTime = new Date(start_date);
    if (end_date) {
      const endDateTime = new Date(end_date);
      if (startDateTime >= endDateTime) {
        return new Response(
          JSON.stringify({ error: 'End date must be after start date' }),
          { status: 400 }
        );
      }
    }

    // Get user ID
    const userRes = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }

    // Check if user is a member of the organization
    const membershipRes = await pool.query(
      `
      SELECT om.*
      FROM public.organization_members om
      WHERE om.organization_id = $1 AND om.user_id = $2 AND om.is_active = true
    `,
      [organization_id, user.id]
    );

    if (membershipRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { status: 403 }
      );
    }

    // Validate all participants are members of the organization
    const participantIds = Array.isArray(participants)
      ? participants
      : [participants];
    const membershipCheck = await pool.query(
      `
      SELECT u.id, u.name, u.email
      FROM public.users u
      JOIN public.organization_members om ON u.id = om.user_id
      WHERE u.id = ANY($1) AND om.organization_id = $2 AND om.is_active = true
    `,
      [participantIds, organization_id]
    );

    if (membershipCheck.rows.length !== participantIds.length) {
      return new Response(
        JSON.stringify({
          error: 'All participants must be members of this organization',
        }),
        { status: 400 }
      );
    }

    // Build members array with user details
    const membersData = membershipCheck.rows.map((member, index) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      order: index + 1,
    }));

    // Create rotation configuration
    const rotationConfig = {
      start_date,
      end_date,
      rotation_type,
      rotation_interval_hours,
      rotation_day,
      timezone,
    };

    // Insert the schedule
    const scheduleRes = await pool.query(
      `
      INSERT INTO public.on_call_schedules (
        organization_id, name, description, is_active, timezone,
        schedule_type, rotation_config, members
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        organization_id,
        name,
        description,
        is_active,
        timezone,
        rotation_type,
        JSON.stringify(rotationConfig),
        JSON.stringify(membersData),
      ]
    );

    // Get the created schedule with organization info
    const createdSchedule = await pool.query(
      `
      SELECT ocs.*,
             o.name as organization_name
      FROM public.on_call_schedules ocs
      JOIN public.organizations o ON ocs.organization_id = o.id
      WHERE ocs.id = $1
    `,
      [scheduleRes.rows[0].id]
    );

    return new Response(
      JSON.stringify({
        schedule: {
          ...createdSchedule.rows[0],
          current_on_call_member:
            membersData.length > 0 ? membersData[0] : null,
          members_count: membersData.length,
        },
        message: 'On-call schedule created successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST on-call schedule error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
