export const runtime = 'edge';

import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
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

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const assignedTo = searchParams.get('assigned_to');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Build base query
    let query = `
      SELECT i.*,
             o.name as organization_name,
             u1.name as created_by_name, u1.email as created_by_email,
             u2.name as assigned_to_name, u2.email as assigned_to_email,
             ep.name as escalation_policy_name,
             (SELECT COUNT(*) FROM public.incident_updates iu WHERE iu.incident_id = i.id) as update_count
      FROM public.incidents i
      JOIN public.organizations o ON i.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      JOIN public.users u1 ON i.created_by = u1.id
      LEFT JOIN public.users u2 ON i.assigned_to = u2.id
      LEFT JOIN public.escalation_policies ep ON i.escalation_policy_id = ep.id
      WHERE om.user_id = $1 AND om.is_active = true
    `;

    const params = [user.id];
    let paramIndex = 2;

    // Add filters
    if (organizationId) {
      query += ` AND i.organization_id = $${paramIndex}`;
      params.push(organizationId);
      paramIndex++;
    }

    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (severity) {
      query += ` AND i.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (assignedTo) {
      query += ` AND i.assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM public.incidents i
      JOIN public.organizations o ON i.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      WHERE om.user_id = $1 AND om.is_active = true
    `;

    const countParams = [user.id];
    let countParamIndex = 2;

    if (organizationId) {
      countQuery += ` AND i.organization_id = $${countParamIndex}`;
      countParams.push(organizationId);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND i.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (severity) {
      countQuery += ` AND i.severity = $${countParamIndex}`;
      countParams.push(severity);
      countParamIndex++;
    }

    if (assignedTo) {
      countQuery += ` AND i.assigned_to = $${countParamIndex}`;
      countParams.push(assignedTo);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return new Response(
      JSON.stringify({
        incidents: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('GET incidents error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const {
      organization_id,
      title,
      description,
      severity = 'medium',
      status = 'open',
      affected_services = [],
      impact_description,
      assigned_to,
      source = 'manual',
      source_id,
      escalation_policy_id,
      tags = [],
    } = body;

    // Validation
    if (!organization_id || !title) {
      return new Response(
        JSON.stringify({ error: 'Organization ID and title are required' }),
        { status: 400 }
      );
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

    // Check if user is a member of the organization and has permission to create incidents
    const membershipRes = await pool.query(
      `
      SELECT om.*, om.can_create_incidents
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

    const membership = membershipRes.rows[0];
    if (
      !membership.can_create_incidents &&
      membership.incident_role !== 'admin' &&
      membership.incident_role !== 'manager'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient permissions to create incidents',
        }),
        { status: 403 }
      );
    }

    // Validate assigned user if provided
    if (assigned_to) {
      const assignedUserRes = await pool.query(
        `
        SELECT u.id
        FROM public.users u
        JOIN public.organization_members om ON u.id = om.user_id
        WHERE u.id = $1 AND om.organization_id = $2 AND om.is_active = true
      `,
        [assigned_to, organization_id]
      );

      if (assignedUserRes.rows.length === 0) {
        return new Response(
          JSON.stringify({
            error:
              'Assigned user not found or not a member of this organization',
          }),
          { status: 400 }
        );
      }
    }

    // Validate escalation policy if provided
    if (escalation_policy_id) {
      const policyRes = await pool.query(
        `
        SELECT id FROM public.escalation_policies
        WHERE id = $1 AND organization_id = $2 AND is_active = true
      `,
        [escalation_policy_id, organization_id]
      );

      if (policyRes.rows.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'Escalation policy not found or not active',
          }),
          { status: 400 }
        );
      }
    }

    // Create incident
    const incidentRes = await pool.query(
      `
      INSERT INTO public.incidents (
        organization_id, title, description, severity, status,
        affected_services, impact_description, assigned_to, created_by,
        source, source_id, escalation_policy_id, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
      [
        organization_id,
        title,
        description,
        severity,
        status,
        affected_services,
        impact_description,
        assigned_to,
        user.id,
        source,
        source_id,
        escalation_policy_id,
        tags,
      ]
    );

    const incident = incidentRes.rows[0];

    // Create initial incident update
    await pool.query(
      `
      INSERT INTO public.incident_updates (
        incident_id, message, status, update_type, posted_by, visible_to_subscribers
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [incident.id, 'Incident created', status, 'update', user.id, true]
    );

    // Get full incident details for response
    const fullIncidentRes = await pool.query(
      `
      SELECT i.*,
             o.name as organization_name,
             u1.name as created_by_name, u1.email as created_by_email,
             u2.name as assigned_to_name, u2.email as assigned_to_email,
             ep.name as escalation_policy_name
      FROM public.incidents i
      JOIN public.organizations o ON i.organization_id = o.id
      JOIN public.users u1 ON i.created_by = u1.id
      LEFT JOIN public.users u2 ON i.assigned_to = u2.id
      LEFT JOIN public.escalation_policies ep ON i.escalation_policy_id = ep.id
      WHERE i.id = $1
    `,
      [incident.id]
    );

    return new Response(
      JSON.stringify({
        incident: fullIncidentRes.rows[0],
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST incidents error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
