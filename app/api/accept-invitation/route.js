import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { SupabaseClient } from '../../lib/db-supabase.js';
import { authOptions } from '../auth/[...nextauth]/route.js';

const db = new SupabaseClient();

// GET - Validate invitation token and return invitation details
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation details
    const invitation = await db.getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.invitation_expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if invitation was already accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 409 }
      );
    }

    // Transform the data to match expected format
    const formattedInvitation = {
      id: invitation.id,
      organization_id: invitation.organization_id,
      organization_name: invitation.organizations?.name,
      role: invitation.role,
      email: invitation.users?.email,
      invited_by_name: invitation.invited_by_user?.name,
      expires_at: invitation.invitation_expires_at,
    };

    return NextResponse.json({
      success: true,
      invitation: formattedInvitation,
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate invitation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST - Accept the invitation
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get invitation details
    const invitation = await db.getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.invitation_expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if invitation was already accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 409 }
      );
    }

    // Verify the invitation is for the current user
    if (invitation.users?.email !== session.user.email) {
      return NextResponse.json(
        { error: 'Invitation is not for your email address' },
        { status: 403 }
      );
    }

    // Accept the invitation
    const acceptedInvitation = await db.acceptInvitation(invitation.id, {
      user_id: user.id,
    });

    // Get organization details for response
    const organization = await db.getOrganizationById(
      invitation.organization_id
    );

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      membership: {
        id: acceptedInvitation.id,
        organization_id: invitation.organization_id,
        organization_name: organization?.name,
        role: acceptedInvitation.role,
        accepted_at: acceptedInvitation.accepted_at,
      },
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to accept invitation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
