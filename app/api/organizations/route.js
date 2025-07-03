import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Find organizations where user is a member
  const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
  const user = userRes.rows[0];
  if (!user) {
    return new Response(JSON.stringify({ organizations: [] }), { status: 200 });
  }
  const orgsRes = await pool.query(`
    SELECT o.*,
           m.role
      FROM public.organizations o
      JOIN public.organization_members m ON o.id = m.organization_id
     WHERE m.user_id = $1
  `, [user.id]);
  return new Response(JSON.stringify({ organizations: orgsRes.rows }), { status: 200 });
}

export async function POST(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  const { name, slug, domain } = body;
  if (!name || !slug) {
    return new Response(JSON.stringify({ error: 'Name and slug are required' }), { status: 400 });
  }

  try {
    // Find user
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }
    // Create organization
    const orgRes = await pool.query(
      'INSERT INTO public.organizations (name, slug, domain) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, domain || null]
    );
    const org = orgRes.rows[0];
    // Add user as owner
    await pool.query(
      'INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [org.id, user.id, 'owner', true]
    );
    return new Response(JSON.stringify({ organization: org }), { status: 201 });
  } catch (e) {
    // Unique constraint violation
    if (e.code === '23505') {
      if (e.constraint === 'organizations_slug_key') {
        return new Response(JSON.stringify({ error: 'That organization slug is already taken. Please choose another.' }), { status: 409 });
      }
      if (e.constraint === 'organizations_name_key') {
        return new Response(JSON.stringify({ error: 'That organization name is already taken. Please choose another.' }), { status: 409 });
      }
      if (e.constraint === 'organizations_domain_key') {
        return new Response(JSON.stringify({ error: 'That organization domain is already in use. Please choose another.' }), { status: 409 });
      }
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
} 