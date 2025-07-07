export const runtime = 'edge';

import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  try {
    const session = await getServerSession();
    console.log('Session user:', session?.user);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }
    // Get org_id from query param or session (for now, require ?org_id=...)
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('org_id');
    console.log('Requested org_id:', orgId);
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing org_id' }), {
        status: 400,
      });
    }
    // Check membership
    // First, get the user ID from the database using the email
    console.log('Looking up user with email:', session.user.email);
    const { rows: userRows } = await pool.query(
      'SELECT id, email FROM public.users WHERE email = $1',
      [session.user.email]
    );
    console.log('User lookup result:', { email: session.user.email, userRows });
    if (userRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404 }
      );
    }
    const userId = userRows[0].id;

    const { rows: memberRows } = await pool.query(
      'SELECT * FROM public.organization_members WHERE user_id = $1 AND organization_id = $2 AND is_active = true',
      [userId, orgId]
    );
    console.log('Membership check:', { userId, orgId, memberRows });
    if (memberRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden - Not a member of this organization',
        }),
        { status: 403 }
      );
    }
    // List status pages
    const { rows } = await pool.query(
      'SELECT * FROM public.status_pages WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
      [orgId]
    );
    console.log('Status pages found:', rows.length);
    return new Response(JSON.stringify({ statusPages: rows }), { status: 200 });
  } catch (err) {
    console.error('Status pages GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession();
    console.log('POST status-pages - Session user:', session?.user);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }
    const body = await req.json();
    console.log('POST status-pages - Request body:', body);
    const { org_id, name, slug, description, is_public } = body;
    if (!org_id || !name || !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }
    // Check membership
    // First, get the user ID from the database using the email
    console.log('Looking up user with email:', session.user.email);
    const { rows: userRows } = await pool.query(
      'SELECT id, email FROM public.users WHERE email = $1',
      [session.user.email]
    );
    console.log('User lookup result:', { email: session.user.email, userRows });
    if (userRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404 }
      );
    }
    const userId = userRows[0].id;

    const { rows: memberRows } = await pool.query(
      'SELECT * FROM public.organization_members WHERE user_id = $1 AND organization_id = $2 AND is_active = true',
      [userId, org_id]
    );
    console.log('Membership check:', { userId, org_id, memberRows });
    if (memberRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden - Not a member of this organization',
        }),
        { status: 403 }
      );
    }
    // Insert status page
    console.log('Attempting to insert status page:', {
      org_id,
      name,
      slug,
      description,
      is_public,
    });
    const insertQuery = `
      INSERT INTO public.status_pages (organization_id, name, slug, description, is_public)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(insertQuery, [
      org_id,
      name,
      slug,
      description || null,
      is_public ?? true,
    ]);
    console.log('Status page created successfully:', rows[0]);
    return new Response(JSON.stringify({ statusPage: rows[0] }), {
      status: 201,
    });
  } catch (err) {
    console.error('POST status-pages error:', err);
    if (err.code === '23505') {
      // Unique violation (slug)
      return new Response(
        JSON.stringify({
          error: 'Slug must be unique within the organization.',
        }),
        { status: 409 }
      );
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
