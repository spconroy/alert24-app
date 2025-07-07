import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET - List pending invitations for an organization
export async function GET(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const orgId = params.id;
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'Organization ID is required' }), { status: 400 });
  }

  try {
    // Check if user is admin/owner of the org
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const membershipRes = await pool.query(
      'SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true',
      [orgId, user.id]
    );
    
    if (membershipRes.rows.length === 0 || !['owner', 'admin'].includes(membershipRes.rows[0].role)) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), { status: 403 });
    }

    // Get pending invitations
    const invitationsRes = await pool.query(`
      SELECT 
        om.id,
        om.invitation_token,
        om.invited_at,
        om.invitation_expires_at,
        om.role,
        u.email,
        u.name,
        invited_by_user.name as invited_by_name
      FROM public.organization_members om
      LEFT JOIN public.users u ON om.user_id = u.id
      LEFT JOIN public.users invited_by_user ON om.invited_by = invited_by_user.id
      WHERE om.organization_id = $1 
        AND om.accepted_at IS NULL 
        AND om.invitation_token IS NOT NULL
        AND om.invitation_expires_at > NOW()
      ORDER BY om.invited_at DESC
    `, [orgId]);

    return new Response(JSON.stringify({ invitations: invitationsRes.rows }), { status: 200 });
  } catch (err) {
    console.error('Error fetching invitations:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// POST - Send new invitation
export async function POST(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const orgId = params.id;
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'Organization ID is required' }), { status: 400 });
  }

  try {
    const body = await req.json();
    const { email, role = 'member' } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
    }

    if (!['member', 'admin'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be member or admin' }), { status: 400 });
    }

    // Check if user is admin/owner of the org
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const membershipRes = await pool.query(
      'SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true',
      [orgId, user.id]
    );
    
    if (membershipRes.rows.length === 0 || !['owner', 'admin'].includes(membershipRes.rows[0].role)) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), { status: 403 });
    }

    // Get organization details
    const orgRes = await pool.query('SELECT name FROM public.organizations WHERE id = $1', [orgId]);
    const organization = orgRes.rows[0];
    if (!organization) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404 });
    }

    // Check if user already exists
    let invitedUser = null;
    const existingUserRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existingUserRes.rows.length > 0) {
      invitedUser = existingUserRes.rows[0];
      
      // Check if already a member
      const existingMemberRes = await pool.query(
        'SELECT id, accepted_at, invitation_token FROM public.organization_members WHERE organization_id = $1 AND user_id = $2',
        [orgId, invitedUser.id]
      );
      
      if (existingMemberRes.rows.length > 0) {
        const existingMember = existingMemberRes.rows[0];
        if (existingMember.accepted_at) {
          return new Response(JSON.stringify({ error: 'User is already a member of this organization' }), { status: 409 });
        } else if (existingMember.invitation_token) {
          return new Response(JSON.stringify({ error: 'User already has a pending invitation' }), { status: 409 });
        }
      }
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    let invitationId;

    if (invitedUser) {
      // User exists, create/update invitation
      const invitationRes = await pool.query(`
        INSERT INTO public.organization_members 
        (organization_id, user_id, role, invited_by, invitation_token, invitation_expires_at, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, false)
        ON CONFLICT (organization_id, user_id) 
        DO UPDATE SET 
          role = EXCLUDED.role,
          invited_by = EXCLUDED.invited_by,
          invitation_token = EXCLUDED.invitation_token,
          invitation_expires_at = EXCLUDED.invitation_expires_at,
          invited_at = NOW(),
          accepted_at = NULL,
          is_active = false
        RETURNING id
      `, [orgId, invitedUser.id, role, user.id, invitationToken, expiresAt]);
      
      invitationId = invitationRes.rows[0].id;
    } else {
      // User doesn't exist, create placeholder user and invitation
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Create placeholder user
        const newUserRes = await client.query(`
          INSERT INTO public.users (email, name) 
          VALUES ($1, $2) 
          RETURNING id
        `, [email, email]); // Use email as name initially
        
        const newUserId = newUserRes.rows[0].id;
        
        // Create invitation
        const invitationRes = await client.query(`
          INSERT INTO public.organization_members 
          (organization_id, user_id, role, invited_by, invitation_token, invitation_expires_at, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, false)
          RETURNING id
        `, [orgId, newUserId, role, user.id, invitationToken, expiresAt]);
        
        invitationId = invitationRes.rows[0].id;
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Create invitation link
    const invitationLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/accept-invitation?token=${invitationToken}`;

    // TODO: Send email invitation (integrate with SendGrid later)
    console.log(`Invitation sent to ${email}:`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Role: ${role}`);
    console.log(`Invitation Link: ${invitationLink}`);
    console.log(`Expires: ${expiresAt}`);

    return new Response(JSON.stringify({ 
      message: 'Invitation sent successfully',
      invitationId,
      invitationLink, // For testing - remove in production
      expiresAt 
    }), { status: 201 });

  } catch (err) {
    console.error('Error sending invitation:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
} 