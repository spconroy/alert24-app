
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const checkType = searchParams.get('check_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = parseInt(searchParams.get('offset')) || 0;

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

    // Build the query with proper column names from actual schema
    let query = `
      SELECT mc.*,
             (mc.status = 'active') as is_active,
             o.name as organization_name,
             u.name as created_by_name, u.email as created_by_email,
             (
               SELECT COUNT(*) 
               FROM public.check_results cr 
               WHERE cr.monitoring_check_id = mc.id 
               AND cr.created_at >= NOW() - INTERVAL '24 hours'
               AND cr.is_successful = false
             ) as recent_failures,
             (
               SELECT cr.is_successful
               FROM public.check_results cr
               WHERE cr.monitoring_check_id = mc.id
               ORDER BY cr.created_at DESC
               LIMIT 1
             ) as last_check_successful,
             (
               SELECT cr.response_time
               FROM public.check_results cr
               WHERE cr.monitoring_check_id = mc.id
               ORDER BY cr.created_at DESC
               LIMIT 1
             ) as last_response_time,
             (
               SELECT cr.created_at
               FROM public.check_results cr
               WHERE cr.monitoring_check_id = mc.id
               ORDER BY cr.created_at DESC
               LIMIT 1
             ) as last_check_time,
             CASE 
               WHEN mc.status != 'active' THEN 'paused'
               WHEN NOT EXISTS (
                 SELECT 1 FROM public.check_results cr 
                 WHERE cr.monitoring_check_id = mc.id
               ) THEN 'unknown'
               WHEN (
                 SELECT cr.is_successful
                 FROM public.check_results cr
                 WHERE cr.monitoring_check_id = mc.id
                 ORDER BY cr.created_at DESC
                 LIMIT 1
               ) = true THEN 'up'
               ELSE 'down'
             END as current_status,
             CASE 
               WHEN mc.status != 'active' THEN NULL
               WHEN NOT EXISTS (
                 SELECT 1 FROM public.check_results cr 
                 WHERE cr.monitoring_check_id = mc.id
               ) THEN NOW() -- Never been checked, should run now
               ELSE (
                 SELECT cr.created_at + (mc.check_interval || ' seconds')::interval
                 FROM public.check_results cr
                 WHERE cr.monitoring_check_id = mc.id
                 ORDER BY cr.created_at DESC
                 LIMIT 1
               )
             END as next_check_time
      FROM public.monitoring_checks mc
      JOIN public.organizations o ON mc.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      JOIN public.users u ON mc.created_by = u.id
      WHERE om.user_id = $1 AND om.is_active = true
    `;

    const params = [user.id];
    let paramIndex = 2;

    // Add filters
    if (organizationId) {
      query += ` AND mc.organization_id = $${paramIndex}`;
      params.push(organizationId);
      paramIndex++;
    }

    if (checkType) {
      query += ` AND mc.check_type = $${paramIndex}`;
      params.push(checkType);
      paramIndex++;
    }

    if (status) {
      // Map status values to match the database enum
      const statusValue =
        status === 'operational'
          ? 'active'
          : status === 'offline'
            ? 'disabled'
            : status;
      query += ` AND mc.status = $${paramIndex}`;
      params.push(statusValue);
      paramIndex++;
    }

    // Add ordering and pagination
    query += ` ORDER BY mc.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT mc.id) as total
      FROM public.monitoring_checks mc
      JOIN public.organizations o ON mc.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      WHERE om.user_id = $1 AND om.is_active = true
    `;

    const countParams = [user.id];
    let countParamIndex = 2;

    if (organizationId) {
      countQuery += ` AND mc.organization_id = $${countParamIndex}`;
      countParams.push(organizationId);
      countParamIndex++;
    }

    if (checkType) {
      countQuery += ` AND mc.check_type = $${countParamIndex}`;
      countParams.push(checkType);
      countParamIndex++;
    }

    if (status) {
      const statusValue =
        status === 'operational'
          ? 'active'
          : status === 'offline'
            ? 'disabled'
            : status;
      countQuery += ` AND mc.status = $${countParamIndex}`;
      countParams.push(statusValue);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return new Response(
      JSON.stringify({
        monitoring_checks: result.rows,
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
    console.error('GET monitoring checks error:', error);
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
      name,
      description = '',
      check_type,
      target_url,
      target_port,
      check_interval_seconds = 300,
      timeout_seconds = 30,
      monitoring_locations = [],
      http_method = 'GET',
      http_headers = {},
      expected_status_codes = [200],
      keyword_match,
      keyword_match_type = 'contains',
      ssl_check_enabled = false,
      follow_redirects = true,
      notification_settings = {},
      is_active = true,
    } = body;

    // Validation
    if (!organization_id || !name || !check_type || !target_url) {
      return new Response(
        JSON.stringify({
          error:
            'Organization ID, name, check type, and target URL are required',
        }),
        { status: 400 }
      );
    }

    // Validate check type
    const validCheckTypes = ['http', 'https', 'ping', 'tcp', 'ssl'];
    if (!validCheckTypes.includes(check_type)) {
      return new Response(
        JSON.stringify({
          error: `Check type must be one of: ${validCheckTypes.join(', ')}`,
        }),
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

    // Build configuration object for HTTP checks
    const configuration = {
      http_method,
      http_headers,
      expected_status_codes,
      follow_redirects,
      ssl_check_enabled,
      ...(keyword_match && { keyword_match, keyword_match_type }),
    };

    // Create monitoring check with proper schema
    const checkRes = await pool.query(
      `
      INSERT INTO public.monitoring_checks (
        organization_id, name, description, check_type, target_url, target_port,
        configuration, check_interval, target_timeout, monitoring_locations,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
      [
        organization_id,
        name,
        description,
        check_type,
        target_url,
        target_port,
        configuration,
        check_interval_seconds,
        timeout_seconds,
        monitoring_locations && monitoring_locations.length > 0
          ? monitoring_locations
          : null,
        is_active ? 'active' : 'disabled',
        user.id,
      ]
    );

    const check = checkRes.rows[0];

    // Get full check details for response
    const fullCheckRes = await pool.query(
      `
      SELECT mc.*,
             o.name as organization_name,
             u.name as created_by_name, u.email as created_by_email
      FROM public.monitoring_checks mc
      JOIN public.organizations o ON mc.organization_id = o.id
      JOIN public.users u ON mc.created_by = u.id
      WHERE mc.id = $1
    `,
      [check.id]
    );

    return new Response(
      JSON.stringify({
        monitoring_check: fullCheckRes.rows[0],
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST monitoring check error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
