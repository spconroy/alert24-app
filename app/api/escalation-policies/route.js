import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';

import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const activeOnly = searchParams.get('active_only') === 'true';

    const filters = {
      organization_id: organizationId,
      active_only: activeOnly,
    };

    // Get escalation policies
    const escalationPolicies = await db.getEscalationPolicies(user.id, filters);

    // Transform the data to match expected format
    const formattedPolicies = escalationPolicies.map(policy => ({
      ...policy,
      organization_name: policy.organizations?.name,
      created_by_name: policy.created_by_user?.name,
      created_by_email: policy.created_by_user?.email,
    }));

    return NextResponse.json({
      success: true,
      escalation_policies: formattedPolicies,
      count: formattedPolicies.length,
    });
  } catch (error) {
    console.error('Error fetching escalation policies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch escalation policies',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      description = '',
      organization_id,
      escalation_timeout_minutes = 30,
      escalation_steps = [],
      notification_config = {},
      is_active = true,
    } = body;

    // Validation
    if (!name || !organization_id) {
      return NextResponse.json(
        { error: 'Name and organization_id are required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(organization_id, user.id);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied - only owners and admins can create escalation policies',
        },
        { status: 403 }
      );
    }

    // Create escalation policy
    const policyData = {
      name,
      description,
      organization_id,
      escalation_timeout_minutes,
      escalation_steps,
      notification_config,
      is_active,
      created_by: user.id,
    };

    const escalationPolicy = await db.createEscalationPolicy(policyData);

    return NextResponse.json(
      {
        success: true,
        escalation_policy: escalationPolicy,
        message: 'Escalation policy created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating escalation policy:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create escalation policy',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const policyId = searchParams.get('id');

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

export async function DELETE(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const policyId = searchParams.get('id');

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
