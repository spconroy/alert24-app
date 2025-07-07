
import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET - Validate invitation token and return invitation details
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Invitation token is required' }),
      { status: 400 }
    );
  }

  try {
    // Get invitation details
    const invitationRes = await pool.query(
      `
      SELECT 
        om.id,
        om.organization_id,
        om.user_id,
        om.role,
        om.invitation_expires_at,
        om.accepted_at,
        o.name as organization_name,
        u.email,
        invited_by_user.name as invited_by_name
      FROM public.organization_members om
      JOIN public.organizations o ON om.organization_id = o.id
      LEFT JOIN public.users u ON om.user_id = u.id
      LEFT JOIN public.users invited_by_user ON om.invited_by = invited_by_user.id
      WHERE om.invitation_token = $1
    `,
      [token]
    );

    if (invitationRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token' }),
        { status: 404 }
      );
    }

    const invitation = invitationRes.rows[0];

    // Check if invitation has expired
    if (new Date() > new Date(invitation.invitation_expires_at)) {
      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 410,
      });
    }

    // Check if invitation has already been accepted
    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({ error: 'Invitation has already been accepted' }),
        { status: 409 }
      );
    }

    return new Response(
      JSON.stringify({
        invitation: {
          organizationName: invitation.organization_name,
          role: invitation.role,
          invitedByName: invitation.invited_by_name,
          email: invitation.email,
          expiresAt: invitation.invitation_expires_at,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error validating invitation:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

// POST - Accept invitation
export async function POST(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(
      JSON.stringify({
        error: 'You must be logged in to accept an invitation',
      }),
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Invitation token is required' }),
        { status: 400 }
      );
    }

    // Get invitation details
    const invitationRes = await pool.query(
      `
      SELECT 
        om.id,
        om.organization_id,
        om.user_id,
        om.role,
        om.invitation_expires_at,
        om.accepted_at,
        u.email as invited_email
      FROM public.organization_members om
      LEFT JOIN public.users u ON om.user_id = u.id
      WHERE om.invitation_token = $1
    `,
      [token]
    );

    if (invitationRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token' }),
        { status: 404 }
      );
    }

    const invitation = invitationRes.rows[0];

    // Check if invitation has expired
    if (new Date() > new Date(invitation.invitation_expires_at)) {
      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 410,
      });
    }

    // Check if invitation has already been accepted
    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({ error: 'Invitation has already been accepted' }),
        { status: 409 }
      );
    }

    // Get current user
    const userRes = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    const currentUser = userRes.rows[0];
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }

    // Verify the invitation is for the current user's email
    if (invitation.invited_email !== session.user.email) {
      return new Response(
        JSON.stringify({
          error: 'This invitation is not for your email address',
        }),
        { status: 403 }
      );
    }

    // Check if user is already a member of the organization
    const existingMemberRes = await pool.query(
      'SELECT id, accepted_at FROM public.organization_members WHERE organization_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL',
      [invitation.organization_id, currentUser.id]
    );

    if (existingMemberRes.rows.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'You are already a member of this organization',
        }),
        { status: 409 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If the invitation was for a different user_id (placeholder user), we need to handle it
      if (invitation.user_id !== currentUser.id) {
        // Delete the old placeholder invitation
        await client.query(
          'DELETE FROM public.organization_members WHERE id = $1',
          [invitation.id]
        );

        // Create new membership for the current user
        await client.query(
          `
          INSERT INTO public.organization_members 
          (organization_id, user_id, role, accepted_at, is_active)
          VALUES ($1, $2, $3, NOW(), true)
        `,
          [invitation.organization_id, currentUser.id, invitation.role]
        );
      } else {
        // Accept the existing invitation
        await client.query(
          `
          UPDATE public.organization_members 
          SET 
            accepted_at = NOW(),
            is_active = true,
            invitation_token = NULL
          WHERE id = $1
        `,
          [invitation.id]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Get organization name for response
    const orgRes = await pool.query(
      'SELECT name FROM public.organizations WHERE id = $1',
      [invitation.organization_id]
    );
    const organizationName = orgRes.rows[0]?.name || 'Unknown Organization';

    return new Response(
      JSON.stringify({
        message: 'Invitation accepted successfully',
        organizationName,
        role: invitation.role,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
