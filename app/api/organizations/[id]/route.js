export const runtime = 'edge';

import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function PUT(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  const { id } = params;
  const body = await req.json();
  const { name, slug, domain, logo_url, primary_color, secondary_color } = body;

  try {
    // Check if user is owner or admin of the organization
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
    const membershipRes = await pool.query(
      'SELECT * FROM public.organization_members WHERE organization_id = $1 AND user_id = $2',
      [id, user.id]
    );
    if (membershipRes.rows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden - Not a member of this organization',
        }),
        { status: 403 }
      );
    }

    // Update organization
    const orgRes = await pool.query(
      'UPDATE public.organizations SET name = $1, slug = $2, domain = $3, logo_url = $4, primary_color = $5, secondary_color = $6 WHERE id = $7 RETURNING *',
      [name, slug, domain, logo_url, primary_color, secondary_color, id]
    );
    const org = orgRes.rows[0];
    return new Response(JSON.stringify({ organization: org }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const orgId = params.id;

    // Get user ID
    const { rows: userRows } = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }
    const userId = userRows[0].id;

    // Check if user is OWNER of the organization
    const { rows: memberRows } = await pool.query(
      'SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true',
      [orgId, userId]
    );
    if (memberRows.length === 0 || memberRows[0].role !== 'owner') {
      return new Response(
        JSON.stringify({
          error: 'Only organization owners can delete organizations',
        }),
        { status: 403 }
      );
    }

    // Get organization details before deletion for logging
    const { rows: orgRows } = await pool.query(
      'SELECT name FROM public.organizations WHERE id = $1',
      [orgId]
    );
    if (orgRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
      });
    }
    const orgName = orgRows[0].name;

    // Delete organization (CASCADE will handle related data)
    // Order matters: services -> status_pages -> organization_members -> organizations
    await pool.query('BEGIN');

    try {
      // Delete services (via status pages CASCADE)
      await pool.query(
        'DELETE FROM public.services WHERE status_page_id IN (SELECT id FROM public.status_pages WHERE organization_id = $1)',
        [orgId]
      );

      // Delete status pages
      await pool.query(
        'DELETE FROM public.status_pages WHERE organization_id = $1',
        [orgId]
      );

      // Delete organization members
      await pool.query(
        'DELETE FROM public.organization_members WHERE organization_id = $1',
        [orgId]
      );

      // Delete organization
      const { rowCount } = await pool.query(
        'DELETE FROM public.organizations WHERE id = $1',
        [orgId]
      );

      if (rowCount === 0) {
        throw new Error('Organization not found or already deleted');
      }

      await pool.query('COMMIT');

      console.log(
        `Organization "${orgName}" (${orgId}) deleted by user ${session.user.email}`
      );

      return new Response(
        JSON.stringify({
          message: 'Organization deleted successfully',
          deletedOrganization: { id: orgId, name: orgName },
        }),
        { status: 200 }
      );
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('DELETE organization error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function GET(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  const orgId = params.id;
  if (!orgId) {
    return new Response(
      JSON.stringify({ error: 'Organization ID is required' }),
      { status: 400 }
    );
  }

  try {
    // Check if user is a member of the org
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
    const membershipRes = await pool.query(
      'SELECT * FROM public.organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, user.id]
    );
    if (membershipRes.rows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden - Not a member of this organization',
        }),
        { status: 403 }
      );
    }

    // Get organization details
    const orgRes = await pool.query(
      'SELECT * FROM public.organizations WHERE id = $1',
      [orgId]
    );
    const organization = orgRes.rows[0];
    if (!organization) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
      });
    }

    // Get all active members and their roles
    console.log('Fetching members for organization:', orgId);
    const membersRes = await pool.query(
      `SELECT u.id, u.email, u.name, m.role, m.is_active, m.accepted_at
       FROM public.organization_members m
       JOIN public.users u ON m.user_id = u.id
       WHERE m.organization_id = $1 
         AND m.is_active = true
         AND (m.accepted_at IS NOT NULL OR m.role = 'owner')
       ORDER BY m.role DESC, u.name ASC`,
      [orgId]
    );
    console.log('Members found:', membersRes.rows);

    return new Response(
      JSON.stringify({
        organization: organization,
        members: membersRes.rows,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
