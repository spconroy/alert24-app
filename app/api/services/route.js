import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const statusPageId = searchParams.get('status_page_id');
    if (!statusPageId) {
      return new Response(JSON.stringify({ error: 'Missing status_page_id' }), { status: 400 });
    }

    // Get user ID
    const { rows: userRows } = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }
    const userId = userRows[0].id;

    // Check that user is member of org that owns the status page
    const { rows: accessRows } = await pool.query(
      `SELECT sp.id FROM public.status_pages sp
       JOIN public.organization_members om ON sp.organization_id = om.organization_id
       WHERE sp.id = $1 AND om.user_id = $2 AND om.is_active = true`,
      [statusPageId, userId]
    );
    if (accessRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Get services for the status page
    const { rows } = await pool.query(
      'SELECT * FROM public.services WHERE status_page_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
      [statusPageId]
    );

    return new Response(JSON.stringify({ services: rows }), { status: 200 });
  } catch (err) {
    console.error('GET services error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const { status_page_id, name, description, status, sort_order } = body;
    if (!status_page_id || !name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Get user ID
    const { rows: userRows } = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }
    const userId = userRows[0].id;

    // Check that user is member of org that owns the status page
    const { rows: accessRows } = await pool.query(
      `SELECT sp.id FROM public.status_pages sp
       JOIN public.organization_members om ON sp.organization_id = om.organization_id
       WHERE sp.id = $1 AND om.user_id = $2 AND om.is_active = true`,
      [status_page_id, userId]
    );
    if (accessRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Insert service
    const insertQuery = `
      INSERT INTO public.services (status_page_id, name, description, status, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      status_page_id,
      name,
      description || null,
      status || 'operational',
      sort_order || 0
    ]);

    return new Response(JSON.stringify({ service: rows[0] }), { status: 201 });
  } catch (err) {
    console.error('POST services error:', err);
    if (err.code === '23505') {
      return new Response(JSON.stringify({ error: 'Service name must be unique within the status page.' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
} 