import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function PUT(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: policyId } = params;

    if (!policyId) {
      return NextResponse.json(
        { error: 'Escalation policy ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if policy exists and user has access
    const existingPolicy = await db.getEscalationPolicyById(policyId, user.id);
    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Escalation policy not found or access denied' },
        { status: 404 }
      );
    }

    // Check permissions
    const membership = await db.getOrganizationMember(
      existingPolicy.organization_id,
      user.id
    );
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can update escalation policies',
        },
        { status: 403 }
      );
    }

    // Update escalation policy
    const updatedPolicy = await db.updateEscalationPolicy(policyId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      escalation_policy: updatedPolicy,
      message: 'Escalation policy updated successfully',
    });
  } catch (error) {
    console.error('Error updating escalation policy:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update escalation policy',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: policyId } = params;

    if (!policyId) {
      return NextResponse.json(
        { error: 'Escalation policy ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if policy exists and user has access
    const existingPolicy = await db.getEscalationPolicyById(policyId, user.id);
    if (!existingPolicy) {
      return NextResponse.json(
        { error: 'Escalation policy not found or access denied' },
        { status: 404 }
      );
    }

    // Check permissions
    const membership = await db.getOrganizationMember(
      existingPolicy.organization_id,
      user.id
    );
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can delete escalation policies',
        },
        { status: 403 }
      );
    }

    // Delete escalation policy
    await db.deleteEscalationPolicy(policyId);

    return NextResponse.json({
      success: true,
      message: 'Escalation policy deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting escalation policy:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete escalation policy',
        details: error.message,
      },
      { status: 500 }
    );
  }
}