import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { emailService } from '@/lib/email-service';
import { rbac } from '@/lib/rbac-middleware';
import { auditLogger, ACTIVITY_TYPES } from '@/lib/audit-logger';

const db = new SupabaseClient();

// Web Crypto API replacement for crypto.randomBytes in Edge Runtime
function generateInvitationToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const runtime = 'edge';

// GET - List pending invitations for an organization  
export async function GET(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = params.id;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to read member invitations
    const permissionCheck = await rbac.checkPermission(user.id, orgId, 'members.read');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        orgId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.read', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    // Get pending invitations
    const invitations = await db.getPendingInvitations(orgId);

    // Transform the data to match expected format
    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      invitation_token: inv.invitation_token,
      invited_at: inv.invited_at,
      invitation_expires_at: inv.invitation_expires_at,
      role: inv.role,
      email: inv.users?.email,
      name: inv.users?.name,
      invited_by_name: inv.invited_by_user?.name,
    }));

    return NextResponse.json({ invitations: formattedInvitations });
  } catch (err) {
    console.error('Error fetching invitations:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Send new invitation
export async function POST(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = params.id;
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, role = 'responder' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['stakeholder', 'responder', 'admin'].includes(role)) {
      return NextResponse.json(
        {
          error: 'Invalid role. Must be stakeholder, responder, or admin',
        },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to invite members
    const permissionCheck = await rbac.checkPermission(user.id, orgId, 'members.invite');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        orgId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.invite', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    const userRole = permissionCheck.userRole;

    // Only owners can invite admins
    if (role === 'admin' && userRole !== 'owner') {
      await auditLogger.logSecurity(
        user.id, 
        orgId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'invite_admin', reason: 'Only owners can invite admins', targetRole: role },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - Only owners can invite admins' },
        { status: 403 }
      );
    }

    // Get organization details
    const organization = await db.getOrganizationById(orgId);
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user already exists
    let invitedUser = await db.getUserByEmail(email);

    if (invitedUser) {
      // Check if already a member
      const existingMember = await db.getOrganizationMember(
        orgId,
        invitedUser.id
      );

      if (existingMember && existingMember.accepted_at) {
        return NextResponse.json(
          {
            error: 'User is already a member of this organization',
          },
          { status: 409 }
        );
      } else if (existingMember && existingMember.invitation_token) {
        return NextResponse.json(
          { error: 'User already has a pending invitation' },
          { status: 409 }
        );
      }
    } else {
      // Create placeholder user
      invitedUser = await db.createUser({
        email: email,
        name: email, // Use email as name initially
      });
    }

    // Generate invitation token and expiry
    const invitationToken = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Create/update invitation
    const invitation = await db.createInvitation({
      organization_id: orgId,
      user_id: invitedUser.id,
      role: role,
      invited_by: user.id,
      invitation_token: invitationToken,
      invitation_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
      accepted_at: null,
      is_active: false,
    });

    // Create invitation link
    const invitationLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/accept-invitation?token=${invitationToken}`;

    // Send email invitation
    const emailResult = await emailService.sendInvitationEmail({
      toEmail: email,
      toName: email.split('@')[0], // Use username part of email as name
      organizationName: organization.name,
      inviterName: user.name || user.email,
      role,
      invitationLink,
      expiresAt: expiresAt.toISOString(),
      organizationBranding: {
        name: organization.name,
        logoUrl: organization.logo_url,
      },
    });

    // Log the invitation activity
    await auditLogger.logMemberActivity(
      user.id,
      orgId,
      ACTIVITY_TYPES.MEMBER_INVITED,
      {
        email,
        role,
        invitationId: invitation.id,
        expiresAt: expiresAt.toISOString(),
        emailSent: emailResult.success,
        emailError: emailResult.success ? null : emailResult.error
      }
    );

    // Log email result
    if (emailResult.success) {
      console.log(
        `✅ Invitation email sent to ${email} (Message ID: ${emailResult.messageId})`
      );
    } else {
      console.error(
        `❌ Failed to send invitation email to ${email}: ${emailResult.error}`
      );
      // Continue with the invitation creation even if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Invitation sent successfully',
        invitationId: invitation.id,
        invitationLink, // For testing - remove in production
        expiresAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error sending invitation:', err);

    // Handle duplicate slug error
    if (
      err.message.includes('duplicate key') ||
      err.message.includes('already exists')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization slug already exists',
          details: err.message,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send invitation',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
