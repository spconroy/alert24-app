
import { Pool } from 'pg';
import { getServerSession } from 'next-auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const statusPageId = searchParams.get('status_page_id');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const since = searchParams.get('since'); // Optional date filter

    if (!statusPageId) {
      return new Response(
        JSON.stringify({ error: 'Missing status_page_id parameter' }),
        { status: 400 }
      );
    }

    // Build the query with optional date filter
    let statusUpdatesQuery = `
      SELECT 
        su.*,
        s.name as service_name,
        u.email as created_by_email
      FROM public.status_updates su
      LEFT JOIN public.services s ON su.service_id = s.id
      LEFT JOIN public.users u ON su.created_by = u.id
      WHERE su.status_page_id = $1 
        AND su.deleted_at IS NULL
    `;

    const queryParams = [statusPageId];

    // Add date filter if provided
    if (since) {
      statusUpdatesQuery += ` AND su.created_at >= $${queryParams.length + 1}`;
      queryParams.push(since);
    }

    statusUpdatesQuery += ` ORDER BY su.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const { rows: statusUpdates } = await pool.query(
      statusUpdatesQuery,
      queryParams
    );

    return new Response(JSON.stringify({ statusUpdates }), { status: 200 });
  } catch (err) {
    console.error('Status updates GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const body = await req.json();
    const { status_page_id, service_id, title, message, update_type, status } =
      body;

    if (!status_page_id || !title || !message) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: status_page_id, title, message',
        }),
        { status: 400 }
      );
    }

    // Validate update_type
    const validUpdateTypes = ['general', 'incident', 'maintenance'];
    if (update_type && !validUpdateTypes.includes(update_type)) {
      return new Response(JSON.stringify({ error: 'Invalid update_type' }), {
        status: 400,
      });
    }

    // Get user ID and verify access to the status page
    const userQuery = `SELECT id FROM public.users WHERE email = $1`;
    const { rows: userRows } = await pool.query(userQuery, [
      session.user.email,
    ]);

    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 403,
      });
    }

    const userId = userRows[0].id;

    // Verify access to status page through organization membership
    const accessQuery = `
      SELECT sp.id, sp.name, sp.organization_id
      FROM public.status_pages sp
      JOIN public.organization_members om ON sp.organization_id = om.organization_id
      WHERE sp.id = $1 AND om.user_id = $2 AND om.is_active = true AND sp.deleted_at IS NULL
    `;
    const { rows: accessRows } = await pool.query(accessQuery, [
      status_page_id,
      userId,
    ]);

    if (accessRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this status page' }),
        { status: 403 }
      );
    }

    // If service_id is provided, verify it belongs to this status page
    if (service_id) {
      const serviceQuery = `
        SELECT id FROM public.services 
        WHERE id = $1 AND status_page_id = $2 AND deleted_at IS NULL
      `;
      const { rows: serviceRows } = await pool.query(serviceQuery, [
        service_id,
        status_page_id,
      ]);

      if (serviceRows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid service_id for this status page' }),
          { status: 400 }
        );
      }
    }

    // Create the status update
    // For general updates without a status, use 'operational' as default
    // This is required due to database NOT NULL constraint
    let finalStatus = status;
    if (!status && (update_type === 'general' || !update_type)) {
      finalStatus = 'operational';
    }

    const insertQuery = `
      INSERT INTO public.status_updates 
      (status_page_id, service_id, title, message, update_type, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const { rows: newUpdates } = await pool.query(insertQuery, [
      status_page_id,
      service_id || null,
      title,
      message,
      update_type || 'general',
      finalStatus,
      userId,
    ]);

    const statusUpdate = newUpdates[0];

    return new Response(
      JSON.stringify({
        message: 'Status update posted successfully',
        statusUpdate: {
          id: statusUpdate.id,
          title: statusUpdate.title,
          message: statusUpdate.message,
          update_type: statusUpdate.update_type,
          status: statusUpdate.status,
          created_at: statusUpdate.created_at,
        },
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error('Status updates POST error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
