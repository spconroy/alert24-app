import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { rbac } from '@/lib/rbac-middleware';
import { auditLogger, ACTIVITY_TYPES } from '@/lib/audit-logger';

const db = new SupabaseClient();

export const runtime = 'edge';

/**
 * Update member status (active, suspended, etc.)
 */
export async function PATCH(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizationId = params.id;
    const memberId = params.memberId;

    if (!organizationId || !memberId) {
      return NextResponse.json({ error: 'Organization ID and Member ID required' }, { status: 400 });
    }

    // Check if user has permission to manage members
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'members.manage');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.manage', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    // Additional check: Can't manage members with equal or higher role
    const canManage = await rbac.canManageMember(user.id, organizationId, memberId);
    if (!canManage.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'member.manage_specific', reason: canManage.reason, targetMemberId: memberId },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + canManage.reason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, reason } = body;

    if (!status || !['active', 'suspended', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'Valid status required (active, suspended, inactive)' }, { status: 400 });
    }

    // Get current member status for audit logging
    const currentMember = await db.getOrganizationMember(organizationId, memberId);
    if (!currentMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const oldStatus = currentMember.is_active ? 'active' : 'inactive';

    // Update member status
    const updateData = {
      is_active: status === 'active',
      updated_at: new Date().toISOString()
    };

    // Add suspension fields if suspending
    if (status === 'suspended') {
      updateData.suspended_at = new Date().toISOString();
      updateData.suspension_reason = reason || 'No reason provided';
      updateData.suspended_by = user.id;
    } else if (status === 'active' && currentMember.suspended_at) {
      // Clear suspension fields when reactivating
      updateData.suspended_at = null;
      updateData.suspension_reason = null;
      updateData.suspended_by = null;
    }

    const { data, error } = await db.client
      .from('organization_members')
      .update(updateData)
      .eq('organization_id', organizationId)
      .eq('user_id', memberId)
      .select()
      .single();

    if (error) throw error;

    // Log the status change
    await auditLogger.logDataChange(
      user.id,
      organizationId,
      ACTIVITY_TYPES.MEMBER_ROLE_CHANGED, // Using role_changed as generic member change
      { type: 'member', id: memberId },
      { status: oldStatus },
      { status, reason },
      {
        action: 'status_change',
        targetMemberId: memberId,
        targetMemberEmail: currentMember.users?.email || 'Unknown'
      }
    );

    return NextResponse.json({
      success: true,
      member: data,
      message: `Member status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating member status:', error);
    return NextResponse.json({ error: 'Failed to update member status' }, { status: 500 });
  }
}

/**
 * Get member status and lifecycle information
 */
export async function GET(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizationId = params.id;
    const memberId = params.memberId;

    if (!organizationId || !memberId) {
      return NextResponse.json({ error: 'Organization ID and Member ID required' }, { status: 400 });
    }

    // Check if user has permission to read member details
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'members.read');
    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    // Get member details
    const member = await db.getOrganizationMember(organizationId, memberId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get member's activity history (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activityHistory } = await db.client
      .from('user_activity_log')
      .select('activity_type, created_at, description')
      .eq('user_id', memberId)
      .eq('organization_id', organizationId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Determine current status
    let currentStatus = 'inactive';
    if (member.is_active) {
      currentStatus = member.suspended_at ? 'suspended' : 'active';
    }

    return NextResponse.json({
      member: {
        ...member,
        current_status: currentStatus,
        status_history: activityHistory || []
      }
    });

  } catch (error) {
    console.error('Error fetching member status:', error);
    return NextResponse.json({ error: 'Failed to fetch member status' }, { status: 500 });
  }
}