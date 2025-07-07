import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get user ID
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
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

    // Process the results to extract current on-call person
    const schedules = result.rows.map(schedule => {
      const members = schedule.members || [];
      const rotationConfig = schedule.rotation_config || {};
      
      // Simple rotation logic - for demo purposes
      let currentOnCallMember = null;
      if (members.length > 0) {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const rotationIndex = dayOfYear % members.length;
        currentOnCallMember = members[rotationIndex];
      }

      return {
        ...schedule,
        current_on_call_member: currentOnCallMember,
        members_count: members.length
      };
    });

    return new Response(JSON.stringify({
      on_call_schedules: schedules
    }), { status: 200 });

  } catch (error) {
    console.error('GET on-call schedules error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
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
      participants = [],
      timezone = 'UTC',
      is_active = true
    } = body;

    // Validation
    if (!organization_id || !name || !start_date || !end_date) {
      return new Response(JSON.stringify({ 
        error: 'Organization ID, name, start date, and end date are required' 
      }), { status: 400 });
    }

    if (participants.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'At least one participant is required' 
      }), { status: 400 });
    }

    // Validate date range
    const startDateTime = new Date(start_date);
    const endDateTime = new Date(end_date);
    
    if (startDateTime >= endDateTime) {
      return new Response(JSON.stringify({ error: 'Start time must be before end time' }), { status: 400 });
    }

    // Get user ID
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Check if user is a member of the organization
    const membershipRes = await pool.query(`
      SELECT om.*
      FROM public.organization_members om
      WHERE om.organization_id = $1 AND om.user_id = $2 AND om.is_active = true
    `, [organization_id, user.id]);

    if (membershipRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), { status: 403 });
    }

    // Validate all participants are members of the organization
    const participantIds = Array.isArray(participants) ? participants : [participants];
    const membershipCheck = await pool.query(`
      SELECT u.id, u.name, u.email
      FROM public.users u
      JOIN public.organization_members om ON u.id = om.user_id
      WHERE u.id = ANY($1) AND om.organization_id = $2 AND om.is_active = true
    `, [participantIds, organization_id]);

    if (membershipCheck.rows.length !== participantIds.length) {
      return new Response(JSON.stringify({ 
        error: 'All participants must be members of this organization' 
      }), { status: 400 });
    }

    // Build members array with user details
    const membersData = membershipCheck.rows.map((member, index) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      order: index + 1
    }));

    // Build rotation configuration
    const rotationConfig = {
      start_date,
      end_date,
      rotation_type,
      rotation_interval_hours,
      timezone
    };

    // Create on-call schedule
    const scheduleRes = await pool.query(`
      INSERT INTO public.on_call_schedules (
        organization_id, name, description, is_active, timezone,
        schedule_type, rotation_config, members
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organization_id, 
      name, 
      description,
      is_active,
      timezone,
      rotation_type,
      rotationConfig,
      JSON.stringify(membersData)
    ]);

    const schedule = scheduleRes.rows[0];

    // Get full schedule details for response
    const fullScheduleRes = await pool.query(`
      SELECT ocs.*,
             o.name as organization_name
      FROM public.on_call_schedules ocs
      JOIN public.organizations o ON ocs.organization_id = o.id
      WHERE ocs.id = $1
    `, [schedule.id]);

    const fullSchedule = fullScheduleRes.rows[0];

    // Add current on-call member
    const members = fullSchedule.members || [];
    let currentOnCallMember = null;
    if (members.length > 0) {
      const now = new Date();
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
      const rotationIndex = dayOfYear % members.length;
      currentOnCallMember = members[rotationIndex];
    }

    return new Response(JSON.stringify({
      on_call_schedule: {
        ...fullSchedule,
        current_on_call_member: currentOnCallMember,
        members_count: members.length
      }
    }), { status: 201 });

  } catch (error) {
    console.error('POST on-call schedule error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 